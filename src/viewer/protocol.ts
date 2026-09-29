import type { ViewerLoadData } from "../types";

export type ViewerToHostMessage =
    | { type: "ready" }
    | { type: "changeColormap"; colormap: string }
    | { type: "getPixelValue" }
    | { type: "exportPng"; data: number[] };

export type HostToViewerMessage =
    | { type: "load"; data: ViewerLoadData }
    | { type: "error"; message: string };

export interface GeoKitHost {
    postMessage(message: ViewerToHostMessage): void;
    onMessage(handler: (message: HostToViewerMessage) => void): () => void;
}
