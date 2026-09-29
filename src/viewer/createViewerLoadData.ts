import type { ParsedGeoTiff, ViewerLoadData } from "../types";

export function createViewerLoadData(
    parsed: ParsedGeoTiff,
    filename: string,
    colormap: string,
    stretchPercent: number,
): ViewerLoadData {
    return {
        width: parsed.width,
        height: parsed.height,
        bandCount: parsed.bandCount,
        allBands: parsed.allBands.map((band) => Array.from(band)),
        bandMins: parsed.bandMins,
        bandMaxes: parsed.bandMaxes,
        noDataValue: parsed.noDataValue,
        colormap,
        stretchPercent,
        metadata: {
            crs: parsed.crs,
            bounds: parsed.bounds,
            compression: parsed.compression,
            dtype: parsed.dtype,
            filename,
            fileDirectory: parsed.fileDirectory,
            geoKeys: parsed.geoKeys,
        },
    };
}
