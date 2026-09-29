import * as vscode from "vscode";

export function getHtmlForWebview(context: vscode.ExtensionContext, webview: vscode.Webview): string {
    const hostScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "vscode-host.js"));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "viewer.js"));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "viewer.css"));
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} blob: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${styleUri}" rel="stylesheet">
    <title>GeoKit</title>
</head>
<body>
    <div id="toolbar">
        <div class="toolbar-group" aria-label="View controls">
            <span class="toolbar-label">View</span>
            <button id="zoom-out" title="Zoom out" aria-label="Zoom out">-</button>
            <span id="zoom-level">100%</span>
            <button id="zoom-in" title="Zoom in" aria-label="Zoom in">+</button>
            <button id="fit-view" title="Fit raster to view">Fit</button>
            <button id="reset-zoom" title="Reset view">Reset</button>
        </div>
        <div class="toolbar-group" id="band-controls" style="display:none;">
            <span class="toolbar-label">Display</span>
            <select id="mode-select" style="display:none;">
                <option value="single">Single band</option>
                <option value="rgb">RGB composite</option>
            </select>
            <div id="band-selector"><label for="band-select">Band</label><select id="band-select"></select></div>
            <div id="rgb-selectors" style="display:none;">
                <label>R <select id="rgb-band-r"></select></label>
                <label>G <select id="rgb-band-g"></select></label>
                <label>B <select id="rgb-band-b"></select></label>
            </div>
        </div>
        <div class="toolbar-group">
            <button id="export-png" title="Export the current raster view as PNG">Export PNG</button>
        </div>
    </div>
    <div id="canvas-container">
        <div id="loading-msg"><div id="spinner"></div></div>
        <canvas id="raster-canvas"></canvas>
        <div id="cursor-tooltip"></div>
    </div>
    <details id="metadata-panel">
        <summary>Metadata</summary>
        <div id="metadata-content"></div>
    </details>
    <details id="stats-panel">
        <summary>Statistics</summary>
        <div id="stats-content">
            <span class="stat-item"><span class="stat-label">Min:</span> <span id="stat-min">--</span></span>
            <span class="stat-item"><span class="stat-label">Max:</span> <span id="stat-max">--</span></span>
            <span class="stat-item"><span class="stat-label">Mean:</span> <span id="stat-mean">--</span></span>
            <span class="stat-item"><span class="stat-label">Median:</span> <span id="stat-median">--</span></span>
            <span class="stat-item"><span class="stat-label">Std Dev:</span> <span id="stat-stddev">--</span></span>
            <span class="stat-item"><span class="stat-label">Valid px:</span> <span id="stat-count">--</span></span>
            <span class="stat-item"><span class="stat-label">Coverage:</span> <span id="stat-coverage">--</span></span>
        </div>
        <canvas id="histogram-canvas"></canvas>
    </details>
    <div id="bottom-bar">
        <div id="colorbar-wrapper">
            <canvas id="colorbar-canvas"></canvas>
            <div id="colorbar-labels">
                <span id="min-label"></span>
                <span id="max-label"></span>
            </div>
            <div id="stretch-controls">
                <label>Min:<input type="number" id="stretch-min" step="any" placeholder="auto"></label>
                <label>Max:<input type="number" id="stretch-max" step="any" placeholder="auto"></label>
                <button id="stretch-reset">Reset</button>
            </div>
        </div>
        <div id="right-controls">
            <div id="colormap-control">
                <label for="colormap-select">Colormap:</label>
                <select id="colormap-select">
                    <option value="viridis">Viridis</option>
                    <option value="plasma">Plasma</option>
                    <option value="inferno">Inferno</option>
                    <option value="magma">Magma</option>
                    <option value="grayscale">Grayscale</option>
                    <option value="jet">Jet</option>
                    <option value="terrain">Terrain</option>
                    <option value="coolwarm">Cool-Warm</option>
                </select>
            </div>
        </div>
    </div>
    <div id="error-message" style="display: none;"></div>
    <script nonce="${nonce}" src="${hostScriptUri}"></script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function getNonce(): string {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let text = "";
    for (let i = 0; i < 32; i++) {
        text += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return text;
}

