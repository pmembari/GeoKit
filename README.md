# GeoKit

<p align="center">
  <img src="./assets/icon.png" alt="GeoKit icon" width="10%" />
</p>

## Overview

GeoKit is an open-source geospatial toolkit designed to bring common raster exploration workflows closer to developers.

The project currently provides a VS Code custom editor for GeoTIFF files. The viewer runs in the webview and uses `geotiff.js` for raster decoding, keeping the normal visualization path lightweight and independent of Python.

GeoKit is being developed toward a broader shared viewer architecture that can later be reused across environments such as VS Code, code-server, and JupyterLab.

## Current capabilities

GeoKit currently supports:

- GeoTIFF files with `.tif`, `.tiff`, and `.geotiff` extensions
- Cloud Optimized GeoTIFFs with embedded overview pyramids
- single-band and multi-band rasters
- RGB composites with selectable R, G, and B bands
- LZW, DEFLATE, ZSTD, PackBits, JPEG, and uncompressed TIFF data supported through `geotiff.js`
- integer and floating-point raster data types
- eight colormaps: Viridis, Plasma, Inferno, Magma, Grayscale, Jet, Terrain, and Cool-Warm
- automatic percentile stretch with manual Min/Max overrides
- interactive zoom, pan, fit-to-view, and reset controls
- pixel values and geographic coordinates on hover
- histogram and statistics inspection
- TIFF tags and GeoKeys metadata inspection
- NoData transparency and coverage reporting
- dimensions, data type, CRS, compression, and resolution in the VS Code status bar
- export of the current rendered view as PNG

For large rasters, GeoKit limits the display workload and uses an available GeoTIFF overview when possible rather than rendering the full-resolution raster directly.

## Architecture

The current architecture keeps the raster viewer independent from the VS Code API:

```text
VS Code extension
    │
    ├── file access
    ├── settings
    ├── status bar
    ├── PNG export
    │
    └── VS Code host adapter
            │
            ▼
      shared browser viewer
            │
            ▼
        geotiff.js
```

The browser viewer does not call `acquireVsCodeApi()` directly. Host communication is isolated behind a small adapter and message protocol.

This separation is intended to make the same viewer reusable in future environments instead of maintaining separate visualization implementations.

## Installation

### Install from a VSIX

Download a GeoKit VSIX from the project releases, then install it from VS Code:

1. Open the Command Palette with `Ctrl+Shift+P` or `Cmd+Shift+P`.
2. Select **Extensions: Install from VSIX...**
3. Choose the downloaded `.vsix` file.

You can also install it from the terminal:

```bash
code --install-extension geokit-0.2.0.vsix
```

### Build from source

```bash
git clone https://github.com/pmembari/GeoKit.git
cd GeoKit

npm ci
npm run typecheck
npm run build
npm run package

code --install-extension geokit-0.2.0.vsix
```

## Usage

Open any supported GeoTIFF file in VS Code. GeoKit is registered as the default custom editor for:

```text
*.tif
*.tiff
*.geotiff
```

Inside the viewer you can switch between single-band and RGB rendering, choose bands and colormaps, adjust the display stretch, inspect metadata and statistics, zoom or pan through the raster, inspect pixel values, and export the current visualization as a PNG.

## Settings

GeoKit currently exposes two VS Code settings.

### Default colormap

```text
geotiffViewer.defaultColormap
```

Default: `viridis`

Available values:

```text
viridis
plasma
inferno
magma
grayscale
jet
terrain
coolwarm
```

### Histogram stretch

```text
geotiffViewer.stretchPercent
```

Default: `2`

This defines the percentage clipped from both ends of the value distribution for the automatic raster stretch. The accepted range is 0–10.

## Development

Requirements:

- Node.js
- npm
- VS Code

Install dependencies:

```bash
npm ci
```

Validate the TypeScript source:

```bash
npm run typecheck
```

Build the extension:

```bash
npm run build
```

Package a VSIX:

```bash
npm run package
```

The extension host is bundled with esbuild into `out/extension.js`. The browser viewer remains under `media/`.

### Source layout

```text
GeoKit/
├── src/
│   ├── editor/         # VS Code custom editor integration
│   ├── viewer/         # host-neutral viewer protocol and data mapping
│   ├── extension.ts    # VS Code extension entry point
│   └── types.ts
├── media/
│   ├── viewer.js       # browser raster viewer
│   ├── viewer.css
│   └── vscode-host.js  # VS Code-specific webview adapter
├── assets/
├── esbuild.config.mjs
├── package.json
└── tsconfig.json
```

## Roadmap

GeoKit is intended to grow beyond a standalone GeoTIFF viewer while keeping the normal visualization path browser-native.

Planned areas include:

- improved large-raster performance with workers and reduced data copying
- code-server validation
- JupyterLab integration using the same shared viewer
- STAC catalog and item browsing
- GeoJSON and vector visualization
- Shapefile and GeoPackage workflows
- raster and vector layer abstractions
- optional Python/GDAL processing for heavier operations such as VRT creation, clipping, reprojection, mosaicking, compositing, and raster calculations

These items are roadmap goals and are **not part of the current released feature set**.

## Design goals

GeoKit prioritizes:

1. fast startup
2. responsive interactive visualization
3. bounded memory usage
4. a small runtime dependency footprint
5. portability across developer environments
6. maintainable shared geospatial components

The project is not intended to replace QGIS. Its goal is to provide common geospatial inspection and lightweight processing workflows directly where developers already work.

## Current limitations

- GeoKit is currently read-only.
- The current extension focuses on raster visualization.
- Very large non-COG files without overview pyramids can still require significant loading and decoding work.
- STAC, vector data, JupyterLab support, and GDAL-backed processing are not yet implemented.

## Contributing

Issues and pull requests are welcome.

When contributing, please keep the viewer layer independent from editor-specific APIs where practical. VS Code-specific behavior should remain in the host adapter or extension integration layer rather than being introduced directly into shared viewer code.

Before submitting changes, run:

```bash
npm ci
npm run typecheck
npm run build
npm run package
```

## License

GeoKit is released under the MIT License.

## Acknowledgements

GeoKit uses [geotiff.js](https://github.com/geotiffjs/geotiff.js) for GeoTIFF parsing and raster decoding.
