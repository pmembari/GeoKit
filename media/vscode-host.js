// @ts-check
(function () {
    // VS Code-specific adapter for the host-neutral GeoKit viewer.
    // The shared viewer only depends on window.GeoKitHost.
    // @ts-ignore
    const vscode = acquireVsCodeApi();

    window.GeoKitHost = {
        postMessage(message) {
            vscode.postMessage(message);
        },
        onMessage(handler) {
            const listener = (event) => handler(event.data);
            window.addEventListener("message", listener);
            return () => window.removeEventListener("message", listener);
        },
    };
})();
