export const FILTERS = {
    NONE: 'none',
    MAGIC: 'magic',
    BW: 'bw',
    PRINT: 'print',
    PHOTO: 'photo',
};

export async function applyFilter(sourceCanvas, filterName) {
    if (filterName === FILTERS.NONE) {
        const c = document.createElement('canvas');
        c.width = sourceCanvas.width;
        c.height = sourceCanvas.height;
        c.getContext('2d').drawImage(sourceCanvas, 0, 0);
        return c;
    }

    const w = sourceCanvas.width;
    const h = sourceCanvas.height;

    const ctx = sourceCanvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, w, h);

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = w;
    outputCanvas.height = h;
    const outCtx = outputCanvas.getContext('2d');

    let resultImageData;

    // Use Web Workers for intensive processing if possible,
    // but for this assignment we run synchronously as per instructions.

    switch (filterName) {
        case FILTERS.BW:
            resultImageData = applyBW(imageData, w, h);
            break;
        case FILTERS.MAGIC:
            resultImageData = applyMagic(imageData, w, h);
            break;
        case FILTERS.PRINT:
            resultImageData = applyPrint(imageData, w, h);
            break;
        case FILTERS.PHOTO:
            resultImageData = applyPhoto(imageData, w, h);
            break;
        default:
            resultImageData = imageData;
    }

    outCtx.putImageData(resultImageData, 0, 0);
    return outputCanvas;
}

// --- Utilities ---

function getGrayscale(data, w, h) {
    const gray = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
    return gray;
}

function grayscaleToImageData(gray, w, h) {
    const out = new ImageData(w, h);
    for (let i = 0; i < w * h; i++) {
        const val = gray[i];
        out.data[i * 4] = val;
        out.data[i * 4 + 1] = val;
        out.data[i * 4 + 2] = val;
        out.data[i * 4 + 3] = 255;
    }
    return out;
}

// rgbToHsl and hslToRgb functions for photo filter
function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h, s, l];
}

function hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
}

function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}


// --- Filters ---

function applyBW(imgData, w, h) {
    const gray = getGrayscale(imgData.data, w, h);

    // Find 5th and 95th percentiles
    const hist = new Array(256).fill(0);
    for (let i = 0; i < gray.length; i++) hist[gray[i]]++;

    let total = w * h;
    let p5 = 0, p95 = 255;
    let sum = 0;
    for (let i = 0; i < 256; i++) {
        sum += hist[i];
        if (sum > total * 0.05 && p5 === 0) p5 = i;
        if (sum > total * 0.95) { p95 = i; break; }
    }

    // Contrast stretch
    for (let i = 0; i < gray.length; i++) {
        let val = gray[i];
        if (val <= p5) val = 0;
        else if (val >= p95) val = 255;
        else val = ((val - p5) / (p95 - p5)) * 255;
        gray[i] = val;
    }

    return grayscaleToImageData(gray, w, h);
}

function applyPrint(imgData, w, h) {
    const gray = getGrayscale(imgData.data, w, h);

    // 1. Unsharp Mask (simplified: original + amount * (original - blurred))
    // Approximation with a small kernel for speed
    const sharpened = new Uint8Array(gray.length);
    const amount = 1.5;

    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const idx = y * w + x;
            // simple 3x3 box blur estimation
            let blurVal = (
                gray[idx-w-1] + gray[idx-w] + gray[idx-w+1] +
                gray[idx-1]   + gray[idx]   + gray[idx+1] +
                gray[idx+w-1] + gray[idx+w] + gray[idx+w+1]
            ) / 9;

            let sharpVal = gray[idx] + amount * (gray[idx] - blurVal);

            // 2. Hard threshold at 128
            sharpened[idx] = sharpVal > 128 ? 255 : 0;
        }
    }

    return grayscaleToImageData(sharpened, w, h);
}

function applyPhoto(imgData, w, h) {
    const out = new ImageData(w, h);
    const d = imgData.data;

    for (let i = 0; i < d.length; i += 4) {
        let r = d[i], g = d[i+1], b = d[i+2];

        let [h_hsl, s, l] = rgbToHsl(r, g, b);

        // 1. Increase saturation 20%
        s = Math.min(1, s * 1.2);

        // 2. S-curve for luminance
        // Shift to [-1, 1], apply cubic, shift back
        let l_norm = l * 2 - 1;
        let l_s = (l_norm * l_norm * l_norm + l_norm) / 2; // mild s-curve
        l = (l_s + 1) / 2;

        // Convert back
        let [nr, ng, nb] = hslToRgb(h_hsl, s, l);

        // 3. Warm tone (red+5, blue-5)
        nr = Math.min(255, nr + 5);
        nb = Math.max(0, nb - 5);

        out.data[i] = nr;
        out.data[i+1] = ng;
        out.data[i+2] = nb;
        out.data[i+3] = 255;
    }

    return out;
}

function gaussianBlur(gray, w, h, radius) {
    const sigma = radius / 2.0;
    const kernel = new Float32Array(radius * 2 + 1);
    let sum = 0;
    for (let i = -radius; i <= radius; i++) {
        const val = Math.exp(-(i * i) / (2 * sigma * sigma));
        kernel[i + radius] = val;
        sum += val;
    }
    for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;

    const out1 = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let acc = 0;
            for (let k = -radius; k <= radius; k++) {
                const px = Math.min(Math.max(x + k, 0), w - 1);
                acc += gray[y * w + px] * kernel[k + radius];
            }
            out1[y * w + x] = acc;
        }
    }

    const out2 = new Float32Array(w * h);
    for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
            let acc = 0;
            for (let k = -radius; k <= radius; k++) {
                const py = Math.min(Math.max(y + k, 0), h - 1);
                acc += out1[py * w + x] * kernel[k + radius];
            }
            out2[y * w + x] = acc;
        }
    }
    return out2;
}

function applyMagic(imgData, w, h) {
    // 1. Convert to grayscale
    const gray = getGrayscale(imgData.data, w, h);

    // 2. Apply Gaussian blur (radius 3)
    const blurred = gaussianBlur(gray, w, h, 3);

    // 3. Subtract blurred from original
    const normalized = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
        normalized[i] = Math.max(0, Math.min(255, gray[i] - blurred[i] + 255));
    }

    // 4. Adaptive thresholding
    const S = 15; // window size
    const s2 = Math.floor(S / 2);
    const C = 10; // constant subtracted from mean

    const intImg = new Uint32Array(w * h);

    for (let y = 0; y < h; y++) {
        let sum = 0;
        for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            sum += normalized[idx];
            if (y === 0) {
                intImg[idx] = sum;
            } else {
                intImg[idx] = intImg[(y - 1) * w + x] + sum;
            }
        }
    }

    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const x1 = Math.max(0, x - s2);
            const x2 = Math.min(w - 1, x + s2);
            const y1 = Math.max(0, y - s2);
            const y2 = Math.min(h - 1, y + s2);

            const count = (x2 - x1 + 1) * (y2 - y1 + 1);

            let sum = intImg[y2 * w + x2];
            if (x1 > 0 && y1 > 0) sum += intImg[(y1 - 1) * w + (x1 - 1)];
            if (x1 > 0) sum -= intImg[y2 * w + (x1 - 1)];
            if (y1 > 0) sum -= intImg[(y1 - 1) * w + x2];

            const mean = sum / count;
            const idx = y * w + x;

            if (normalized[idx] < mean - C) {
                out[idx] = 0; // foreground
            } else {
                out[idx] = 255; // background
            }
        }
    }

    // 5. Slight dilation (erode the white background)
    const dilated = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const idx = y * w + x;
            if (out[idx] === 0 || out[idx-1] === 0 || out[idx+1] === 0 || out[idx-w] === 0 || out[idx+w] === 0) {
                dilated[idx] = 0;
            } else {
                dilated[idx] = 255;
            }
        }
    }

    // Edge case for borders (keep white)
    for (let i = 0; i < w; i++) { dilated[i] = 255; dilated[(h-1)*w + i] = 255; }
    for (let i = 0; i < h; i++) { dilated[i*w] = 255; dilated[i*w + w - 1] = 255; }

    return grayscaleToImageData(dilated, w, h);
}
