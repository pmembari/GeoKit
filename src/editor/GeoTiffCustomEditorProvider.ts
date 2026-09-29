import * as vscode from "vscode";
import { parseGeoTiff } from "./geoTiffParser";
import { buildStatusContent } from "./status";
import { getHtmlForWebview } from "./webviewHtml";
import type { ParsedGeoTiff, ViewerLoadData } from "../types";

interface GeoTiffCustomDocument extends vscode.CustomDocument {
    readonly uri: vscode.Uri;
}

type WebviewMessage =
    | { type: "changeColormap"; colormap: string }
    | { type: "getPixelValue" }
    | { type: "exportPng"; data: number[] };

export class GeoTiffCustomEditorProvider implements vscode.CustomReadonlyEditorProvider<GeoTiffCustomDocument> {
    public static readonly viewType = "geotiffViewer.raster";
    private static statusInfo: vscode.StatusBarItem;

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        GeoTiffCustomEditorProvider.statusInfo = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        context.subscriptions.push(GeoTiffCustomEditorProvider.statusInfo);

        const provider = new GeoTiffCustomEditorProvider(context);
        return vscode.window.registerCustomEditorProvider(GeoTiffCustomEditorProvider.viewType, provider, {
            webviewOptions: {
                retainContextWhenHidden: true,
            },
            supportsMultipleEditorsPerDocument: false,
        });
    }

    private constructor(private readonly context: vscode.ExtensionContext) {}

    public async openCustomDocument(uri: vscode.Uri): Promise<GeoTiffCustomDocument> {
        return {
            uri,
            dispose: () => {
                // Read-only documents have no custom resources to release.
            },
        };
    }

    public async resolveCustomEditor(
        document: GeoTiffCustomDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken,
    ): Promise<void> {
        webviewPanel.webview.options = {
            enableScripts: true,
        };
        webviewPanel.webview.html = getHtmlForWebview(this.context, webviewPanel.webview);

        let statusText = "";
        let statusTooltip: vscode.MarkdownString | undefined;

        try {
            const bytes = await vscode.workspace.fs.readFile(document.uri);
            const parsed = await parseGeoTiff(bytes);
            const status = buildStatusContent(parsed);
            statusText = status.text;
            statusTooltip = status.tooltip;

            if (webviewPanel.active) {
                this.applyStatusBar(statusText, statusTooltip);
            }

            const settings = vscode.workspace.getConfiguration("geotiffViewer");
            const colormap = settings.get<string>("defaultColormap") ?? "viridis";
            const stretchPercent = settings.get<number>("stretchPercent") ?? 2;

            await webviewPanel.webview.postMessage({
                type: "load",
                data: this.toViewerLoadData(parsed, document.uri, colormap, stretchPercent),
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            await webviewPanel.webview.postMessage({
                type: "error",
                message: `Failed to load GeoTIFF: ${message}`,
            });
            void vscode.window.showErrorMessage(`Failed to load GeoTIFF: ${message}`);
        }

        webviewPanel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
            switch (message.type) {
                case "changeColormap":
                case "getPixelValue":
                    break;
                case "exportPng":
                    await this.exportPng(document.uri, message.data);
                    break;
            }
        });

        webviewPanel.onDidChangeViewState(() => {
            if (webviewPanel.visible && statusTooltip) {
                this.applyStatusBar(statusText, statusTooltip);
            } else {
                GeoTiffCustomEditorProvider.statusInfo.hide();
            }
        });

        webviewPanel.onDidDispose(() => {
            GeoTiffCustomEditorProvider.statusInfo.hide();
        });
    }

    private toViewerLoadData(
        parsed: ParsedGeoTiff,
        uri: vscode.Uri,
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
                filename: uri.fsPath.split(/[\\/]/).pop() ?? uri.fsPath,
                fileDirectory: parsed.fileDirectory,
                geoKeys: parsed.geoKeys,
            },
        };
    }

    private async exportPng(sourceUri: vscode.Uri, data: number[]): Promise<void> {
        const defaultFilename = `${sourceUri.fsPath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") ?? "geotiff"}.png`;
        const defaultUri = vscode.Uri.joinPath(vscode.Uri.file(sourceUri.fsPath.replace(/[^\\/]+$/, "")), defaultFilename);
        const targetUri = await vscode.window.showSaveDialog({
            defaultUri,
            filters: {
                "PNG Image": ["png"],
            },
        });

        if (targetUri) {
            await vscode.workspace.fs.writeFile(targetUri, new Uint8Array(data));
        }
    }

    private applyStatusBar(text: string, tooltip: vscode.MarkdownString): void {
        GeoTiffCustomEditorProvider.statusInfo.text = text;
        GeoTiffCustomEditorProvider.statusInfo.tooltip = tooltip;
        GeoTiffCustomEditorProvider.statusInfo.show();
    }
}

