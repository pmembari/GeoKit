// @ts-check
(function () {
    const host = window.GeoKitHost;
    if (!host) {
        throw new Error("GeoKit host adapter is not available");
    }

    const DEBUG = false;
    function debugLog(/** @type {any[]} */ ...args) {
        if (DEBUG) console.log('[GeoTIFF Viewer]', ...args);
    }

    // Smart value formatting based on magnitude
    function formatValue(val) {
        if (val === null || val === undefined || isNaN(val)) return 'NaN';
        if (!isFinite(val)) return String(val);
        const abs = Math.abs(val);
        if (abs === 0) return '0';
        if (abs >= 1e6 || abs < 0.001) return val.toExponential(3);
        if (abs >= 1000) return val.toFixed(1);
        if (abs >= 1) return val.toFixed(3);
        if (abs >= 0.01) return val.toFixed(4);
        return val.toFixed(6);
    }

    // Colormap definitions
    const colormaps = {
        viridis: [
            [68, 1, 84], [72, 40, 120], [62, 74, 137], [49, 104, 142],
            [38, 130, 142], [31, 158, 137], [53, 183, 121], [109, 205, 89],
            [180, 222, 44], [253, 231, 37]
        ],
        plasma: [
            [13, 8, 135], [75, 3, 161], [125, 3, 168], [168, 34, 150],
            [203, 70, 121], [229, 107, 93], [248, 148, 65], [253, 195, 40],
            [240, 249, 33]
        ],
        inferno: [
            [0, 0, 4], [31, 12, 72], [85, 15, 109], [136, 34, 106],
            [186, 54, 85], [227, 89, 51], [249, 140, 10], [249, 201, 50],
            [252, 255, 164]
        ],
        magma: [
            [0, 0, 4], [28, 16, 68], [79, 18, 123], [129, 37, 129],
            [181, 54, 122], [229, 80, 100], [251, 135, 97], [254, 194, 135],
            [252, 253, 191]
        ],
        grayscale: [
            [0, 0, 0], [255, 255, 255]
        ],
        jet: [
            [0, 0, 127], [0, 0, 255], [0, 127, 255], [0, 255, 255],
            [127, 255, 127], [255, 255, 0], [255, 127, 0], [255, 0, 0],
            [127, 0, 0]
        ],
        terrain: [
            [51, 51, 153], [68, 119, 170], [85, 153, 136], [119, 170, 102],
            [153, 187, 85], [187, 204, 102], [221, 221, 136], [238, 238, 187],
            [255, 255, 255]
        ],
        coolwarm: [
            [59, 76, 192], [98, 130, 234], [141, 176, 254], [184, 208, 249],
            [221, 221, 221], [245, 196, 173], [244, 154, 123], [222, 96, 77],
            [180, 4, 38]
        ]
    };

    // State
    let rasterData = null;
    let rasterBounds = null;
    let rasterCrs = null;
    let currentColormap = 'viridis';
    let zoom = 1;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    // Multi-band state
    let currentBand = 0;
    let renderMode = 'single'; // 'single' | 'rgb'
    let rgbBands = [0, 1, 2];

    // Manual stretch state (null = use auto percentile stretch)
    let manualStretchMin = null;
    let manualStretchMax = null;

    // DOM elements
    const canvas = document.getElementById('raster-canvas');
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('canvas-container');
    const colormapSelect = document.getElementById('colormap-select');
    const resetZoomBtn = document.getElementById('reset-zoom');
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const fitViewBtn = document.getElementById('fit-view');
    const zoomLevel = document.getElementById('zoom-level');
    const exportPngBtn = document.getElementById('export-png');
    const cursorTooltip = document.getElementById('cursor-tooltip');
    const errorDiv = document.getElementById('error-message');
    const colorbarCanvas = document.getElementById('colorbar-canvas');
    const colorbarCtx = colorbarCanvas.getContext('2d');
    const minLabel = document.getElementById('min-label');
    const maxLabel = document.getElementById('max-label');
    const colorbarWrapper = document.getElementById('colorbar-wrapper');
    const colormapControl = document.getElementById('colormap-control');
    const loadingMsg = document.getElementById('loading-msg');

    // Band / RGB control elements
    const bandControlsWrapper = document.getElementById('band-controls');
    const modeSelect = document.getElementById('mode-select');
    const bandSelector = document.getElementById('band-selector');
    const bandSelect = document.getElementById('band-select');
    const rgbSelectors = document.getElementById('rgb-selectors');
    const rgbBandR = document.getElementById('rgb-band-r');
    const rgbBandG = document.getElementById('rgb-band-g');
    const rgbBandB = document.getElementById('rgb-band-b');

    // Metadata panel elements
    const metadataContent = document.getElementById('metadata-content');

    // Histogram and stretch control elements
    const histogramCanvas = document.getElementById('histogram-canvas');
    const histogramCtx = histogramCanvas.getContext('2d');
    const stretchMinInput = document.getElementById('stretch-min');
    const stretchMaxInput = document.getElementById('stretch-max');
    const stretchResetBtn = document.getElementById('stretch-reset');
    const stretchControls = document.getElementById('stretch-controls');

    // Statistics elements
    const statMin = document.getElementById('stat-min');
    const statMax = document.getElementById('stat-max');
    const statMean = document.getElementById('stat-mean');
    const statMedian = document.getElementById('stat-median');
    const statStddev = document.getElementById('stat-stddev');
    const statCount = document.getElementById('stat-count');
    const statCoverage = document.getElementById('stat-coverage');

    function setOptionalStat(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    // Interpolate between colormap colors
    function getColor(value, min, max, colormapName) {
        const cmap = colormaps[colormapName] || colormaps.viridis;

        // Normalize value to 0-1
        let t = (value - min) / (max - min);
        t = Math.max(0, Math.min(1, t));

        // Find position in colormap
        const idx = t * (cmap.length - 1);
        const lower = Math.floor(idx);
        const upper = Math.min(lower + 1, cmap.length - 1);
        const frac = idx - lower;

        // Interpolate
        const r = Math.round(cmap[lower][0] * (1 - frac) + cmap[upper][0] * frac);
        const g = Math.round(cmap[lower][1] * (1 - frac) + cmap[upper][1] * frac);
        const b = Math.round(cmap[lower][2] * (1 - frac) + cmap[upper][2] * frac);

        return [r, g, b];
    }

    // Calculate percentile for histogram stretch
    function calculatePercentile(sorted, percentile) {
        if (sorted.length === 0) return 0;
        const idx = Math.floor(sorted.length * percentile / 100);
        return sorted[Math.min(idx, sorted.length - 1)];
    }

    // Compute and display statistics from the sorted valid values array.
    // displayMin/displayMax are the colorbar stretch range, passed in so the
    // Stats panel min/max matches the legend exactly.
    function computeStatistics(sortedValues) {
        const n = sortedValues.length;
        if (n === 0) return;

        // Always show the true data extremes, not the colormap stretch range
        const min = sortedValues[0];
        const max = sortedValues[n - 1];

        // Mean
        let sum = 0;
        for (let i = 0; i < n; i++) sum += sortedValues[i];
        const mean = sum / n;

        // Median
        const median = n % 2 === 0
            ? (sortedValues[n / 2 - 1] + sortedValues[n / 2]) / 2
            : sortedValues[Math.floor(n / 2)];

        // Standard deviation
        let sumSq = 0;
        for (let i = 0; i < n; i++) {
            const d = sortedValues[i] - mean;
            sumSq += d * d;
        }
        const stddev = Math.sqrt(sumSq / n);

        // QGIS-style distribution summary. Keep these optional so older panel
        // markup remains compatible with this script.
        setOptionalStat('stat-q1', formatValue(calculatePercentile(sortedValues, 25)));
        setOptionalStat('stat-q3', formatValue(calculatePercentile(sortedValues, 75)));
        setOptionalStat('stat-p02', formatValue(calculatePercentile(sortedValues, 2)));
        setOptionalStat('stat-p98', formatValue(calculatePercentile(sortedValues, 98)));

        statMin.textContent = formatValue(min);
        statMax.textContent = formatValue(max);
        statMean.textContent = formatValue(mean);
        statMedian.textContent = formatValue(median);
        statStddev.textContent = formatValue(stddev);
        statCount.textContent = n.toLocaleString();
        setOptionalStat('stat-valid-count', n.toLocaleString());
    }

    // Populate a <select> element with band options (1-indexed labels, 0-indexed values).
    // Pass includeNone=true to prepend a "None" option with value '-1'.
    function populateBandSelect(selectEl, bandCount, includeNone = false) {
        selectEl.innerHTML = '';
        if (includeNone) {
            const opt = document.createElement('option');
            opt.value = '-1';
            opt.textContent = 'None';
            selectEl.appendChild(opt);
        }
        for (let i = 0; i < bandCount; i++) {
            const opt = document.createElement('option');
            opt.value = String(i);
            opt.textContent = `Band ${i + 1}`;
            selectEl.appendChild(opt);
        }
    }

    // Show/hide colorbar, colormap, and band controls based on renderMode
    function updateModeUI() {
        if (renderMode === 'rgb') {
            colorbarWrapper.style.visibility = 'hidden';
            colormapControl.style.display = 'none';
            bandSelector.style.display = 'none';
            rgbSelectors.style.display = '';
            stretchControls.style.display = 'none';
            histogramCanvas.style.display = 'none';
        } else {
            colorbarWrapper.style.visibility = 'visible';
            colormapControl.style.display = '';
            bandSelector.style.display = '';
            rgbSelectors.style.display = 'none';
            stretchControls.style.display = '';
            histogramCanvas.style.display = '';
        }
    }

    // Top-level render dispatcher
    function render() {
        if (!rasterData) return;
        if (renderMode === 'rgb') {
            renderRgb();
        } else {
            renderSingleBand();
        }
    }

    // Single-band rendering with colormap
    function renderSingleBand() {
        if (!rasterData) return;

        try {
            const { width, height, noDataValue, stretchPercent } = rasterData;
            const values = rasterData.allBands[currentBand];

            debugLog('Rendering band', currentBand, ':', width, '×', height, 'pixels');

            // Filter valid values, excluding null/undefined from JSON serialization of NaN
            const validValues = values.filter(v => {
                if (v === null || v === undefined) return false;
                if (noDataValue !== null && v === noDataValue) return false;
                return !isNaN(v) && isFinite(v);
            });

            // Sort once, reuse for both percentile lookups and statistics
            validValues.sort((a, b) => a - b);

            let minVal, maxVal;
            if (stretchPercent > 0 && validValues.length > 0) {
                minVal = calculatePercentile(validValues, stretchPercent);
                maxVal = calculatePercentile(validValues, 100 - stretchPercent);
            } else {
                minVal = rasterData.bandMins[currentBand];
                maxVal = rasterData.bandMaxes[currentBand];
            }

            // Guard against equal min/max (prevents division by zero in getColor)
            if (minVal === maxVal) {
                minVal = minVal - 0.5;
                maxVal = maxVal + 0.5;
            }
            // Guard against null/undefined min/max from JSON-serialized Infinity
            if (minVal == null || maxVal == null || !isFinite(minVal) || !isFinite(maxVal)) {
                minVal = 0;
                maxVal = 1;
            }

            // Manual stretch override (both inputs must be valid numbers with lo < hi)
            if (manualStretchMin !== null && manualStretchMax !== null) {
                minVal = manualStretchMin;
                maxVal = manualStretchMax;
            }

            debugLog('minVal:', minVal, 'maxVal:', maxVal, 'validCount:', validValues.length);

            // Set canvas size
            canvas.width = width;
            canvas.height = height;

            // Create image data
            const imageData = ctx.createImageData(width, height);
            const data = imageData.data;

            for (let i = 0; i < values.length; i++) {
                const val = values[i];
                const idx = i * 4;

                // Handle nodata — include null/undefined (JSON-serialized NaN)
                if (val === null || val === undefined ||
                    (noDataValue !== null && val === noDataValue) ||
                    isNaN(val)) {
                    data[idx] = 0;
                    data[idx + 1] = 0;
                    data[idx + 2] = 0;
                    data[idx + 3] = 0; // Transparent
                } else {
                    const [r, g, b] = getColor(val, minVal, maxVal, currentColormap);
                    data[idx] = r;
                    data[idx + 1] = g;
                    data[idx + 2] = b;
                    data[idx + 3] = 255;
                }
            }

            ctx.putImageData(imageData, 0, 0);

            // Apply zoom and pan
            updateTransform();

            // Update colorbar
            renderColorbar(minVal, maxVal);

            // Update labels with smart formatting
            minLabel.textContent = formatValue(minVal);
            maxLabel.textContent = formatValue(maxVal);

            // Compute statistics from the already-sorted valid values,
            // using the display (stretch) range for min/max so they match the legend
            computeStatistics(validValues);
            statCoverage.textContent = values.length > 0
                ? (validValues.length / values.length * 100).toFixed(1) + '%'
                : '--';
            setOptionalStat('stat-nodata-count', (values.length - validValues.length).toLocaleString());
            renderHistogram(validValues, minVal, maxVal);
        } catch (err) {
            console.error('[GeoTIFF Viewer] Render error:', err);
            errorDiv.textContent = 'Render error: ' + (err.message || String(err));
            errorDiv.style.display = 'block';
        }
    }

    // RGB composite rendering — maps three bands to R, G, B channels.
    // A band index of -1 means "None": that channel outputs 0 for every pixel.
    function renderRgb() {
        if (!rasterData) return;

        try {
            const { width, height, allBands, noDataValue, stretchPercent } = rasterData;
            const [ri, gi, bi] = rgbBands;

            // null for "None" channels (index === -1)
            const rBand = ri >= 0 ? allBands[ri] : null;
            const gBand = gi >= 0 ? allBands[gi] : null;
            const bBand = bi >= 0 ? allBands[bi] : null;

            // Per-channel percentile stretch
            function stretchChannel(band, globalMin, globalMax) {
                const valid = Array.from(band).filter(v =>
                    v !== null && v !== undefined && !isNaN(v) && isFinite(v) &&
                    (noDataValue === null || v !== noDataValue)
                ).sort((a, b) => a - b);
                if (valid.length === 0) return [globalMin, globalMax];
                if (stretchPercent > 0) {
                    return [
                        calculatePercentile(valid, stretchPercent),
                        calculatePercentile(valid, 100 - stretchPercent)
                    ];
                }
                return [valid[0], valid[valid.length - 1]];
            }

            // Only stretch active (non-None) channels; None channels get a dummy [0,1] range
            const [rMin, rMax] = rBand ? stretchChannel(rBand, rasterData.bandMins[ri], rasterData.bandMaxes[ri]) : [0, 1];
            const [gMin, gMax] = gBand ? stretchChannel(gBand, rasterData.bandMins[gi], rasterData.bandMaxes[gi]) : [0, 1];
            const [bMin, bMax] = bBand ? stretchChannel(bBand, rasterData.bandMins[bi], rasterData.bandMaxes[bi]) : [0, 1];

            canvas.width = width;
            canvas.height = height;
            const imageData = ctx.createImageData(width, height);
            const d = imageData.data;
            let validCount = 0;

            for (let i = 0; i < width * height; i++) {
                const rv = rBand ? rBand[i] : null;
                const gv = gBand ? gBand[i] : null;
                const bv = bBand ? bBand[i] : null;
                const idx = i * 4;

                // noData: only consider active (non-None) channels
                const activePairs = [[rBand, rv], [gBand, gv], [bBand, bv]].filter(([band]) => band !== null);
                const isNoData = activePairs.length > 0 && activePairs.some(([, v]) =>
                    v === null || v === undefined || isNaN(v) ||
                    (noDataValue !== null && v === noDataValue)
                );

                if (isNoData) {
                    d[idx] = d[idx + 1] = d[idx + 2] = d[idx + 3] = 0;
                } else {
                    d[idx]     = rBand ? Math.round(Math.max(0, Math.min(255, (rv - rMin) / (rMax - rMin) * 255))) : 0;
                    d[idx + 1] = gBand ? Math.round(Math.max(0, Math.min(255, (gv - gMin) / (gMax - gMin) * 255))) : 0;
                    d[idx + 2] = bBand ? Math.round(Math.max(0, Math.min(255, (bv - bMin) / (bMax - bMin) * 255))) : 0;
                    d[idx + 3] = 255;
                    validCount++;
                }
            }

            const total = width * height;
            statCoverage.textContent = total > 0 ? (validCount / total * 100).toFixed(1) + '%' : '--';

            ctx.putImageData(imageData, 0, 0);
            updateTransform();
        } catch (err) {
            console.error('[GeoTIFF Viewer] RGB render error:', err);
            errorDiv.textContent = 'RGB render error: ' + (err.message || String(err));
            errorDiv.style.display = 'block';
        }
    }

    function renderColorbar(min, max) {
        colorbarCanvas.width = 256;
        colorbarCanvas.height = 16;

        const imageData = colorbarCtx.createImageData(256, 16);
        for (let x = 0; x < 256; x++) {
            const t = x / 255;
            const val = min + t * (max - min);
            const [r, g, b] = getColor(val, min, max, currentColormap);

            for (let y = 0; y < 16; y++) {
                const idx = (y * 256 + x) * 4;
                imageData.data[idx] = r;
                imageData.data[idx + 1] = g;
                imageData.data[idx + 2] = b;
                imageData.data[idx + 3] = 255;
            }
        }
        colorbarCtx.putImageData(imageData, 0, 0);
    }

    function renderHistogram(sortedValues, minVal, maxVal) {
        const w = histogramCanvas.offsetWidth || 256;
        const h = 64;
        histogramCanvas.width = w;
        histogramCanvas.height = h;
        if (sortedValues.length === 0) return;

        const dataMin = sortedValues[0];
        const dataMax = sortedValues[sortedValues.length - 1];
        const range = dataMax - dataMin || 1;
        const numBins = Math.min(w, 256);
        const bins = new Array(numBins).fill(0);
        for (let i = 0; i < sortedValues.length; i++) {
            const b = Math.floor((sortedValues[i] - dataMin) / range * (numBins - 1));
            bins[Math.max(0, Math.min(numBins - 1, b))]++;
        }
        const maxCount = Math.max(...bins);

        histogramCtx.clearRect(0, 0, w, h);
        histogramCtx.fillStyle = getComputedStyle(document.body)
            .getPropertyValue('--vscode-charts-blue') || '#4e9fd5';
        for (let b = 0; b < numBins; b++) {
            const barH = (bins[b] / maxCount) * h;
            const x = Math.round(b / numBins * w);
            const bw = Math.max(1, Math.round(w / numBins));
            histogramCtx.fillRect(x, h - barH, bw, barH);
        }

        // Vertical markers for current stretch range
        histogramCtx.strokeStyle = 'rgba(255,255,255,0.85)';
        histogramCtx.lineWidth = 1.5;
        [minVal, maxVal].forEach(v => {
            const x = Math.round((v - dataMin) / range * w);
            histogramCtx.beginPath();
            histogramCtx.moveTo(x, 0);
            histogramCtx.lineTo(x, h);
            histogramCtx.stroke();
        });
    }

    function updateTransform() {
        canvas.style.transform = `scale(${zoom}) translate(${panX}px, ${panY}px)`;
        if (zoomLevel) zoomLevel.textContent = `${Math.round(zoom * 100)}%`;
    }

    function setZoom(nextZoom, clientX, clientY) {
        const next = Math.max(0.1, Math.min(nextZoom, 50));
        if (clientX !== undefined && clientY !== undefined && zoom > 0) {
            const rect = container.getBoundingClientRect();
            const x = (clientX - rect.left - rect.width / 2) / zoom - panX;
            const y = (clientY - rect.top - rect.height / 2) / zoom - panY;
            panX -= x * (next - zoom) / next;
            panY -= y * (next - zoom) / next;
        }
        zoom = next;
        updateTransform();
    }

    function resetView() {
        zoom = 1;
        panX = 0;
        panY = 0;

        // Fit to container
        if (rasterData) {
            const containerRect = container.getBoundingClientRect();
            const scaleX = containerRect.width / rasterData.width;
            const scaleY = containerRect.height / rasterData.height;
            zoom = Math.min(scaleX, scaleY, 1) * 0.9;
        }

        updateTransform();
    }

    function getPixelCoords(event) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = Math.floor((event.clientX - rect.left) * scaleX);
        const y = Math.floor((event.clientY - rect.top) * scaleY);

        return { x, y };
    }

    // Format geo-coordinate display based on CRS type
    function formatGeoCoord(geoX, geoY) {
        // Heuristic: lat/lon values are typically small (< 360), projected coords are large
        const isLatLon = rasterCrs && /^EPSG:(4326|4269|4267|4258|4674)$/.test(rasterCrs);
        if (isLatLon || (Math.abs(geoX) <= 360 && Math.abs(geoY) <= 360)) {
            return geoX.toFixed(6) + ', ' + geoY.toFixed(6);
        }
        return geoX.toFixed(2) + ', ' + geoY.toFixed(2);
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function populateMetadata(fileDirectory, geoKeys, data) {
        function buildRows(obj) {
            return Object.entries(obj).map(([k, v]) => {
                const display = Array.isArray(v) ? v.join(', ') : String(v);
                return `<tr><td class="meta-key">${escapeHtml(k)}</td><td class="meta-val">${escapeHtml(display)}</td></tr>`;
            }).join('');
        }

        const width = data && data.width;
        const height = data && data.height;
        const bounds = data && data.metadata && data.metadata.bounds;
        const crs = data && data.metadata && data.metadata.crs;
        const pixelCount = width && height ? width * height : null;
        const resolution = bounds && width && height ? [
            Math.abs((bounds[2] - bounds[0]) / width),
            Math.abs((bounds[3] - bounds[1]) / height)
        ] : null;
        const tag = (key) => fileDirectory && fileDirectory[key] !== undefined ? fileDirectory[key] : null;
        const overview = [
            ['Raster size', width && height ? `${width.toLocaleString()} × ${height.toLocaleString()} px` : null],
            ['Bands', data && data.bandCount],
            ['Data type', data && (data.dataType || data.sampleFormat)],
            ['Pixel count', pixelCount ? pixelCount.toLocaleString() : null],
            ['Compression', tag('Compression') || tag('compression')],
            ['Photometric', tag('PhotometricInterpretation') || tag('photometricInterpretation')]
        ].filter(([, value]) => value !== null && value !== undefined);
        const spatial = [
            ['CRS', crs],
            ['Resolution', resolution ? `${formatValue(resolution[0])} × ${formatValue(resolution[1])}` : null],
            ['Extent', bounds && bounds.length === 4 ? bounds.map(formatValue).join(' / ') : null],
            ['NoData value', data && data.noDataValue !== null && data.noDataValue !== undefined ? formatValue(data.noDataValue) : 'Not set']
        ].filter(([, value]) => value !== null && value !== undefined);

        function cards(title, rows) {
            if (!rows.length) return '';
            return `<section class="meta-card"><h3>${title}</h3><dl>${rows.map(([key, value]) =>
                `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl></section>`;
        }

        let html = '<div class="metadata-overview">' + cards('Raster overview', overview) + cards('Spatial reference', spatial) + '</div>';
        html += '<details class="meta-raw" open><summary>Raw TIFF tags &amp; GeoKeys</summary><table class="meta-table">';
        if (fileDirectory && Object.keys(fileDirectory).length > 0) {
            html += `<tr class="meta-section"><th colspan="2">File Directory</th></tr>${buildRows(fileDirectory)}`;
        }
        if (geoKeys && Object.keys(geoKeys).length > 0) {
            html += `<tr class="meta-section"><th colspan="2">Geo Keys</th></tr>${buildRows(geoKeys)}`;
        }
        html += '</table></details>';
        metadataContent.innerHTML = html;
    }

    // Event listeners
    colormapSelect.addEventListener('change', (e) => {
        currentColormap = e.target.value;
        render();
        host.postMessage({ type: 'changeColormap', colormap: currentColormap });
    });

    resetZoomBtn.addEventListener('click', resetView);
    zoomInBtn.addEventListener('click', () => setZoom(zoom * 1.25));
    zoomOutBtn.addEventListener('click', () => setZoom(zoom / 1.25));
    fitViewBtn.addEventListener('click', resetView);

    exportPngBtn.addEventListener('click', () => {
        canvas.toBlob(blob => {
            blob.arrayBuffer().then(buffer => {
                host.postMessage({ type: 'exportPng', data: Array.from(new Uint8Array(buffer)) });
            });
        }, 'image/png');
    });

    bandSelect.addEventListener('change', (e) => {
        currentBand = parseInt(e.target.value);
        render();
    });

    modeSelect.addEventListener('change', (e) => {
        renderMode = e.target.value;
        updateModeUI();
        render();
    });

    [rgbBandR, rgbBandG, rgbBandB].forEach((sel, i) => {
        sel.addEventListener('change', (e) => {
            rgbBands[i] = parseInt(e.target.value);
            render();
        });
    });

    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        // Normalise deltaY to pixels so mouse wheel (deltaMode=1, ~3 lines)
        // and trackpad (deltaMode=0, continuous pixels) feel equally sensitive.
        const pixelDelta = e.deltaMode === 1 ? e.deltaY * 20 : e.deltaY;
        setZoom(zoom * Math.pow(0.999, pixelDelta), e.clientX, e.clientY);
    }, { passive: false });

    container.addEventListener('mousedown', (e) => {
        isDragging = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        container.style.cursor = 'grabbing';
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        container.style.cursor = 'grab';
    });

    window.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const dx = (e.clientX - lastMouseX) / zoom;
            const dy = (e.clientY - lastMouseY) / zoom;
            panX += dx;
            panY += dy;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            updateTransform();
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!rasterData || isDragging) return;

        const { x, y } = getPixelCoords(e);

        if (x >= 0 && x < rasterData.width && y >= 0 && y < rasterData.height) {
            const idx = y * rasterData.width + x;

            let text = `(${x}, ${y})`;

            // Append geo-coordinates if bounds are available
            if (rasterBounds && rasterBounds.length === 4 &&
                rasterBounds.every(v => isFinite(v))) {
                const [minX, minY, maxX, maxY] = rasterBounds;
                const geoX = minX + (x + 0.5) / rasterData.width * (maxX - minX);
                const geoY = maxY - (y + 0.5) / rasterData.height * (maxY - minY);
                text += ' | ' + formatGeoCoord(geoX, geoY);
            }

            if (renderMode === 'rgb') {
                // Only show values for active (non-None) channels
                const labels = ['R', 'G', 'B'];
                const parts = [];
                rgbBands.forEach((bandIdx, ci) => {
                    if (bandIdx >= 0) {
                        parts.push(`${labels[ci]}: ${formatValue(rasterData.allBands[bandIdx][idx])}`);
                    }
                });
                if (parts.length > 0) text += ' | ' + parts.join('  ');
            } else {
                const value = rasterData.allBands[currentBand][idx];
                if (rasterData.noDataValue !== null && value === rasterData.noDataValue) {
                    text += ': NoData';
                } else if (value === null || value === undefined || isNaN(value)) {
                    text += ': NaN';
                } else {
                    text += ': ' + formatValue(value);
                }
            }

            cursorTooltip.textContent = text;
            const rect = container.getBoundingClientRect();
            let tx = e.clientX - rect.left + 14;
            let ty = e.clientY - rect.top - 36;
            if (ty < 4) ty = e.clientY - rect.top + 20;
            cursorTooltip.style.left = tx + 'px';
            cursorTooltip.style.top  = ty + 'px';
            cursorTooltip.style.display = 'block';
        }
    });

    canvas.addEventListener('mouseleave', () => {
        cursorTooltip.style.display = 'none';
    });

    function applyManualStretch() {
        const lo = parseFloat(stretchMinInput.value);
        const hi = parseFloat(stretchMaxInput.value);
        if (!isNaN(lo) && !isNaN(hi) && lo < hi) {
            manualStretchMin = lo;
            manualStretchMax = hi;
        } else {
            manualStretchMin = null;
            manualStretchMax = null;
        }
        render();
    }

    stretchMinInput.addEventListener('change', applyManualStretch);
    stretchMaxInput.addEventListener('change', applyManualStretch);

    stretchResetBtn.addEventListener('click', () => {
        manualStretchMin = null;
        manualStretchMax = null;
        stretchMinInput.value = '';
        stretchMaxInput.value = '';
        render();
    });

    // Handle messages from the host adapter.
    host.onMessage((message) => {
        debugLog('Message received:', message.type);

        switch (message.type) {
            case 'load':
                rasterData = message.data;
                currentColormap = message.data.colormap || 'viridis';
                colormapSelect.value = currentColormap;

                // Reset band state on new file load
                currentBand = 0;
                renderMode = 'single';
                rgbBands = [0, 1, 2];

                // Reset manual stretch on new file
                manualStretchMin = null;
                manualStretchMax = null;
                stretchMinInput.value = '';
                stretchMaxInput.value = '';

                // Store geo-referencing info
                const meta = message.data.metadata;
                rasterBounds = meta.bounds || null;
                rasterCrs = meta.crs || null;

                // Populate band selectors
                // RGB channel selects include a "None" option (value='-1')
                populateBandSelect(bandSelect, message.data.bandCount, false);
                populateBandSelect(rgbBandR, message.data.bandCount, true);
                populateBandSelect(rgbBandG, message.data.bandCount, true);
                populateBandSelect(rgbBandB, message.data.bandCount, true);

                // Smart RGB defaults based on band count:
                //   ≥3 bands → R=0, G=1, B=2  (all three active)
                //   2 bands  → R=0, G=1, B=None (third channel zeroed)
                const bc = message.data.bandCount;
                if (bc >= 3) {
                    rgbBands = [0, 1, 2];
                    if (rgbBandR) rgbBandR.value = '0';
                    if (rgbBandG) rgbBandG.value = '1';
                    if (rgbBandB) rgbBandB.value = '2';
                } else {
                    rgbBands = [0, 1, -1];
                    if (rgbBandR) rgbBandR.value = '0';
                    if (rgbBandG) rgbBandG.value = '1';
                    if (rgbBandB) rgbBandB.value = '-1';
                }

                // Sync mode select back to 'single'
                modeSelect.value = 'single';

                // Visibility rules:
                // 1 band  → hide entire #band-controls
                // ≥2 bands → show #band-controls and #mode-select
                bandControlsWrapper.style.display = bc > 1 ? '' : 'none';
                modeSelect.style.display = bc >= 2 ? '' : 'none';

                updateModeUI();
                populateMetadata(meta.fileDirectory, meta.geoKeys, message.data);

                errorDiv.style.display = 'none';
                render();
                if (loadingMsg) { loadingMsg.style.display = 'none'; }
                // Defer resetView so browser completes layout after canvas resize
                requestAnimationFrame(() => resetView());
                break;

            case 'error':
                errorDiv.textContent = message.message;
                errorDiv.style.display = 'block';
                break;
        }
    });

    // Signal only after the viewer has registered its host message listener.
    // This prevents the initial load message from being lost during webview startup.
    host.postMessage({ type: 'ready' });

    // Set initial cursor
    container.style.cursor = 'grab';
})();
