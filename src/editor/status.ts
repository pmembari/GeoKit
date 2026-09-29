import * as vscode from "vscode";
import type { ParsedGeoTiff } from "../types";

export interface StatusContent {
    text: string;
    tooltip: vscode.MarkdownString;
}

export function buildStatusContent(parsed: ParsedGeoTiff): StatusContent {
    const downsampled = parsed.width !== parsed.originalWidth || parsed.height !== parsed.originalHeight;
    const dimensions = downsampled
        ? `${parsed.originalWidth}×${parsed.originalHeight} → ${parsed.width}×${parsed.height}`
        : `${parsed.width}×${parsed.height}`;

    const parts = [`$(file-media) ${dimensions}`, `$(symbol-type-parameter) ${parsed.dtype}`];
    if (parsed.crs) {
        parts.push(`$(globe) ${parsed.crs}`);
    }
    parts.push(`$(archive) ${parsed.compression}`);

    const tooltipLines = [
        "**GeoTIFF**",
        "",
        `- Dimensions: ${downsampled
            ? `${parsed.originalWidth} × ${parsed.originalHeight} (displayed at ${parsed.width} × ${parsed.height})`
            : `${parsed.width} × ${parsed.height}`}`,
        `- Bands: ${parsed.bandCount}`,
        `- Data type: ${parsed.dtype}`,
    ];

    if (parsed.crs) {
        tooltipLines.push(`- CRS: ${parsed.crs}`);
    }

    tooltipLines.push(`- Compression: ${parsed.compression}`);

    if (parsed.bounds && parsed.bounds.length === 4) {
        const [minX, minY, maxX, maxY] = parsed.bounds;
        const resolutionX = (maxX - minX) / parsed.originalWidth;
        const resolutionY = (maxY - minY) / parsed.originalHeight;
        const resolution = (resolutionX + resolutionY) / 2;
        const units = /^EPSG:(4326|4269|4267|4258|4674)$/.test(parsed.crs ?? "")
            || (!parsed.crs && Math.abs(maxX) <= 360 && Math.abs(maxY) <= 360)
            ? "°/px"
            : "m/px";
        const formattedResolution = resolution < 0.001 ? resolution.toExponential(3) : resolution.toPrecision(4);
        tooltipLines.push(`- Resolution: ${formattedResolution} ${units}`);
    }

    return {
        text: parts.join("  "),
        tooltip: new vscode.MarkdownString(tooltipLines.join("\n")),
    };
}

