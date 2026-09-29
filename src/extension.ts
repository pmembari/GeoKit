import * as vscode from "vscode";
import { GeoTiffCustomEditorProvider } from "./editor/GeoTiffCustomEditorProvider";

export function activate(context: vscode.ExtensionContext): void {
    context.subscriptions.push(GeoTiffCustomEditorProvider.register(context));
}

export function deactivate(): void {
    // Nothing to dispose outside the extension context subscriptions.
}

