# GeoTIFF Viewer for VS Code

A VS Code extension for viewing GeoTIFF raster files directly in the editor. Supports LZW, DEFLATE, ZSTD, and other common compressions used in satellite imagery and remote sensing data.

![GeoTIFF Viewer screenshot](https://github.com/pmembari/GeoKit/raw/HEAD/assets/screenshot.png)

## Features

- **Full compression support**: LZW, DEFLATE, ZSTD, PackBits, JPEG, and more
- **Data type support**: Float32, Float64, Int8/16/32, UInt8/16/32
- **Eight colormaps**: Viridis, Plasma, Inferno, Magma, Jet, Terrain, Grayscale, Cool-Warm
- **Interactive viewing**: scroll to zoom, drag to pan, fit to screen on load
- **Multi-band support**: band selector dropdown; RGB composite mode with per-channel percentile stretch
- Automatic 2% percentile histogram stretch with manual Min/Max override inputs
- Histogram panel with current stretch range markers
- **Statistics panel**: min, max, mean, median, std dev, valid pixel count, NoData coverage %
- **Metadata inspector**: collapsible panel showing all TIFF file directory tags and GeoKeys
- Pixel value and geographic coordinate display on hover
- Ground resolution in the status bar tooltip (m/px or °/px)
- **Export current view as PNG**
- COG overview loading: reads from the appropriate pre-built overview pyramid for fast display of large files
- Status bar showing dimensions, data type, CRS, and compression for the active file
- NoData pixels rendered as transparent

## Supported Formats

- `.tif`, `.tiff`, `.geotiff` files
- Cloud Optimized GeoTIFFs (COGs)
- Standard GeoTIFF with embedded georeferencing
- Single-band and multi-band rasters (e.g., ECOSTRESS LST, DEMs, Landsat, Sentinel-2)

## Installation

### From GitHub Releases

1. Download `GeoKit-0.2.0.vsix` from the [latest release](https://github.com/pmembari/GeoKit/releases/latest)
2. In VS Code, open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Run **Extensions: Install from VSIX...** and select the downloaded file

Or via the terminal:
```bash
code --install-extension GeoKit-0.2.0.vsix
```

### From Source

```bash
git clone https://github.com/pmembari/GeoKit
cd GeoKit
npm install
npm run package
code --install-extension GeoKit-0.2.0.vsix
```

## Usage

1. Open any `.tif`, `.tiff`, or `.geotiff` file in VS Code
2. The GeoTIFF Viewer opens automatically
3. **Scroll** to zoom in/out; **drag** to pan; click **Reset View** to fit the image
4. Switch bands via the **Band** dropdown; enable **RGB Composite** mode for multi-band files
5. **Hover** over the image to see pixel values and geographic coordinates
6. Expand the **Metadata** or **Statistics** panels by clicking their headers
7. Click **Export PNG** to save the current view

## Known Limitations

- Read-only (no editing capability)
- Very large non-COG files (>500 MB without embedded overview pyramids) may be slow to load

## Development

```bash
# Watch mode for development
npm run watch

# Open VS Code with extension loaded
# Press F5 in VS Code to launch Extension Development Host
```

## License

MIT

## Credits

Uses [geotiff.js](https://github.com/geotiffjs/geotiff.js) for TIFF parsing.
