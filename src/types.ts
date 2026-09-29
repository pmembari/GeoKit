export type SerializableValue =
    | string
    | number
    | boolean
    | null
    | SerializableValue[]
    | { [key: string]: SerializableValue };

export interface ParsedGeoTiff {
    width: number;
    height: number;
    originalWidth: number;
    originalHeight: number;
    allBands: Array<ArrayLike<number>>;
    bandCount: number;
    bandMins: number[];
    bandMaxes: number[];
    noDataValue: number | null;
    crs: string | null;
    bounds: number[] | null;
    compression: string;
    dtype: string;
    fileDirectory: Record<string, SerializableValue>;
    geoKeys: Record<string, SerializableValue>;
}

export interface ViewerLoadData {
    width: number;
    height: number;
    bandCount: number;
    allBands: number[][];
    bandMins: number[];
    bandMaxes: number[];
    noDataValue: number | null;
    colormap: string;
    stretchPercent: number;
    metadata: {
        crs: string | null;
        bounds: number[] | null;
        compression: string;
        dtype: string;
        filename: string;
        fileDirectory: Record<string, SerializableValue>;
        geoKeys: Record<string, SerializableValue>;
    };
}

