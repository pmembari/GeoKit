import { fromArrayBuffer } from "geotiff";
import type { GeoTIFFImage } from "geotiff";
import type { ParsedGeoTiff, SerializableValue } from "../types";

const DISPLAY_PIXEL_LIMIT = 4_000_000;

const COMPRESSION_NAMES: Record<number, string> = {
    1: "Uncompressed",
    5: "LZW",
    6: "JPEG (old)",
    7: "JPEG",
    8: "DEFLATE",
    32773: "PackBits",
    50000: "ZSTD",
    50001: "WebP",
};

const OMITTED_METADATA_KEYS = new Set([
    "StripOffsets",
    "StripByteCounts",
    "TileOffsets",
    "TileByteCounts",
    "GeoKeyDirectory",
    "JPEGTables",
    "ModelTransformation",
]);

type GeoTiffDirectory = Record<string, unknown>;

export async function parseGeoTiff(bytes: Uint8Array): Promise<ParsedGeoTiff> {
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const tiff = await fromArrayBuffer(buffer);
    const baseImage = await tiff.getImage();
    const originalWidth = baseImage.getWidth();
    const originalHeight = baseImage.getHeight();

    let displayWidth = originalWidth;
    let displayHeight = originalHeight;
    if (originalWidth * originalHeight > DISPLAY_PIXEL_LIMIT) {
        const scale = Math.sqrt(DISPLAY_PIXEL_LIMIT / (originalWidth * originalHeight));
        displayWidth = Math.round(originalWidth * scale);
        displayHeight = Math.round(originalHeight * scale);
    }

    const imageCount = await tiff.getImageCount();
    let readImage = baseImage;
    let usedOverview = false;

    if (originalWidth * originalHeight > DISPLAY_PIXEL_LIMIT && imageCount > 1) {
        const firstOverview = await tiff.getImage(1);
        usedOverview = firstOverview.getWidth() < originalWidth || firstOverview.getHeight() < originalHeight;

        if (usedOverview) {
            const overviewCandidates: Array<{ image: GeoTIFFImage; pixels: number }> = [];
            for (let i = 1; i < imageCount; i++) {
                const image = await tiff.getImage(i);
                const width = image.getWidth();
                const height = image.getHeight();
                if (width < originalWidth && height < originalHeight) {
                    overviewCandidates.push({ image, pixels: width * height });
                }
            }

            if (overviewCandidates.length > 0) {
                overviewCandidates.sort((a, b) => a.pixels - b.pixels);
                const targetPixels = displayWidth * displayHeight;
                readImage = overviewCandidates.find((candidate) => candidate.pixels >= targetPixels)?.image
                    ?? overviewCandidates[overviewCandidates.length - 1].image;

                const overviewWidth = readImage.getWidth();
                const overviewHeight = readImage.getHeight();
                if (displayWidth > overviewWidth || displayHeight > overviewHeight) {
                    displayWidth = overviewWidth;
                    displayHeight = overviewHeight;
                }
            }
        }
    }

    let rasters = await readImage.readRasters({ width: displayWidth, height: displayHeight });

    if (!usedOverview && rasters.length === 1 && imageCount > 1) {
        const sameSizeBands: Array<ArrayLike<number>> = [rasters[0] as ArrayLike<number>];
        for (let i = 1; i < imageCount; i++) {
            const image = await tiff.getImage(i);
            if (image.getWidth() !== originalWidth || image.getHeight() !== originalHeight) {
                continue;
            }

            const band = await image.readRasters({ width: displayWidth, height: displayHeight });
            sameSizeBands.push(band[0] as ArrayLike<number>);
        }

        if (sameSizeBands.length > 1) {
            rasters = sameSizeBands as typeof rasters;
        }
    }

    const noDataValue = baseImage.getGDALNoData();
    const fileDirectory = baseImage.fileDirectory as GeoTiffDirectory;
    const compression = getCompressionName(fileDirectory.Compression);
    const dtype = getDataType(fileDirectory);
    const geoKeys = baseImage.getGeoKeys() as GeoTiffDirectory;
    const crs = getCrs(geoKeys);
    const bounds = getBounds(baseImage);

    const allBands: Array<ArrayLike<number>> = [];
    const bandMins: number[] = [];
    const bandMaxes: number[] = [];

    for (const raster of rasters as Array<ArrayLike<number>>) {
        let min = Number.POSITIVE_INFINITY;
        let max = Number.NEGATIVE_INFINITY;

        for (let i = 0; i < raster.length; i++) {
            const value = raster[i];
            if ((noDataValue !== null && value === noDataValue) || Number.isNaN(value)) {
                continue;
            }
            if (value < min) min = value;
            if (value > max) max = value;
        }

        if (!Number.isFinite(min) || !Number.isFinite(max)) {
            min = 0;
            max = 1;
        }

        allBands.push(raster);
        bandMins.push(min);
        bandMaxes.push(max);
    }

    return {
        width: displayWidth,
        height: displayHeight,
        originalWidth,
        originalHeight,
        allBands,
        bandCount: allBands.length,
        bandMins,
        bandMaxes,
        noDataValue,
        crs,
        bounds,
        compression,
        dtype,
        fileDirectory: sanitizeForJson(fileDirectory),
        geoKeys: sanitizeForJson(geoKeys),
    };
}

function getCompressionName(compression: unknown): string {
    const value = typeof compression === "number" ? compression : 1;
    return COMPRESSION_NAMES[value] ?? `Unknown (${value})`;
}

function getDataType(fileDirectory: GeoTiffDirectory): string {
    const sampleFormat = firstNumber(fileDirectory.SampleFormat) ?? 1;
    const bitsPerSample = firstNumber(fileDirectory.BitsPerSample) ?? 8;

    if (sampleFormat === 1) return `UInt${bitsPerSample}`;
    if (sampleFormat === 2) return `Int${bitsPerSample}`;
    if (sampleFormat === 3) return `Float${bitsPerSample}`;
    return "Unknown";
}

function getCrs(geoKeys: GeoTiffDirectory): string | null {
    if (typeof geoKeys.ProjectedCSTypeGeoKey === "number") {
        return `EPSG:${geoKeys.ProjectedCSTypeGeoKey}`;
    }
    if (typeof geoKeys.GeographicTypeGeoKey === "number") {
        return `EPSG:${geoKeys.GeographicTypeGeoKey}`;
    }
    return null;
}

function getBounds(image: GeoTIFFImage): number[] | null {
    try {
        return image.getBoundingBox();
    } catch {
        return null;
    }
}

function firstNumber(value: unknown): number | null {
    if (typeof value === "number") {
        return value;
    }
    if (ArrayBuffer.isView(value)) {
        const view = value as ArrayBufferView & ArrayLike<number>;
        if (view.length > 0) {
            return Number(view[0]);
        }
    }
    if (Array.isArray(value) && value.length > 0) {
        return Number(value[0]);
    }
    return null;
}

function sanitizeForJson(input: GeoTiffDirectory): Record<string, SerializableValue> {
    const output: Record<string, SerializableValue> = {};

    for (const [key, value] of Object.entries(input)) {
        if (OMITTED_METADATA_KEYS.has(key) || value === null || value === undefined) {
            continue;
        }

        output[key] = toSerializableValue(value);
    }

    return output;
}

function toSerializableValue(value: unknown): SerializableValue {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
        return value;
    }

    if (ArrayBuffer.isView(value)) {
        const values = Array.from(value as unknown as ArrayLike<unknown>, (entry) => toPrimitiveSerializable(entry));
        return values.length > 16 ? `[${values.length} values]` : values;
    }

    if (Array.isArray(value)) {
        const values = value.map((entry) => toPrimitiveSerializable(entry));
        return values.length > 16 ? `[${values.length} values]` : values;
    }

    return String(value);
}

function toPrimitiveSerializable(value: unknown): string | number | boolean | null {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
        return value;
    }
    if (value === undefined) {
        return null;
    }
    return String(value);
}
