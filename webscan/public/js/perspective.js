// State for Crop UI
let handles = [];
let isDragging = false;
let dragIndex = -1;
let canvasRect = null;
let uiContainer = null;
let uiCanvas = null;
let uiCtx = null;

export function initCropUI(editorCanvas, container) {
    uiContainer = container;

    // Create an overlay canvas for handles and mask
    uiCanvas = document.createElement('canvas');
    uiCanvas.style.position = 'absolute';
    uiCanvas.style.top = '0';
    uiCanvas.style.left = '0';
    uiCanvas.style.width = '100%';
    uiCanvas.style.height = '100%';
    uiCanvas.style.pointerEvents = 'auto';
    uiCanvas.style.zIndex = '10';

    container.appendChild(uiCanvas);
    uiCtx = uiCanvas.getContext('2d');

    // Initialise handles at 10% inset
    const cw = editorCanvas.width;
    const ch = editorCanvas.height;

    const insetX = cw * 0.1;
    const insetY = ch * 0.1;

    // Normalised coordinates [0, 1] relative to intrinsic image size
    handles = [
        { x: insetX / cw, y: insetY / ch },           // TL
        { x: (cw - insetX) / cw, y: insetY / ch },    // TR
        { x: (cw - insetX) / cw, y: (ch - insetY) / ch }, // BR
        { x: insetX / cw, y: (ch - insetY) / ch }     // BL
    ];

    // Bind events
    uiCanvas.addEventListener('mousedown', handleDown);
    uiCanvas.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    uiCanvas.addEventListener('touchstart', handleTouchDown, { passive: false });
    uiCanvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleUp);

    // Initial draw
    resizeUI();
    window.addEventListener('resize', resizeUI);
}

export function destroyCropUI() {
    if (uiCanvas && uiCanvas.parentNode) {
        uiCanvas.parentNode.removeChild(uiCanvas);
    }
    window.removeEventListener('resize', resizeUI);
    window.removeEventListener('mouseup', handleUp);
    window.removeEventListener('touchend', handleUp);
    uiCanvas = null;
    uiCtx = null;
}

export function getCropCorners() {
    // Return normalised coordinates [0, 1]
    return handles;
}

function resizeUI() {
    if (!uiCanvas) return;

    // Match display size
    const rect = uiCanvas.parentNode.getBoundingClientRect();
    uiCanvas.width = rect.width;
    uiCanvas.height = rect.height;
    canvasRect = rect;

    drawCropUI();
}

// --- Drawing UI ---

function drawCropUI() {
    if (!uiCtx) return;
    const w = uiCanvas.width;
    const h = uiCanvas.height;

    // Clear
    uiCtx.clearRect(0, 0, w, h);

    // Convert normalised handles to display coordinates
    // We assume the underlying image is scaled to 'contain' in the container
    // Need to find actual image bounds on screen.
    // Hack: assume the underlying #editor-canvas handles 'contain' by centering.
    const editorCanvas = document.getElementById('editor-canvas');
    if (!editorCanvas) return;

    const imgRatio = editorCanvas.width / editorCanvas.height;
    const containerRatio = w / h;

    let imgDisplayW, imgDisplayH, offsetX = 0, offsetY = 0;

    if (imgRatio > containerRatio) {
        imgDisplayW = w;
        imgDisplayH = w / imgRatio;
        offsetY = (h - imgDisplayH) / 2;
    } else {
        imgDisplayH = h;
        imgDisplayW = h * imgRatio;
        offsetX = (w - imgDisplayW) / 2;
    }

    // Map normalised -> display pixels
    const displayPts = handles.map(h => ({
        x: offsetX + h.x * imgDisplayW,
        y: offsetY + h.y * imgDisplayH
    }));

    // Draw mask (darken outside polygon)
    uiCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    uiCtx.beginPath();
    uiCtx.moveTo(0, 0);
    uiCtx.lineTo(w, 0);
    uiCtx.lineTo(w, h);
    uiCtx.lineTo(0, h);
    uiCtx.closePath();

    // Sub-path for the cutout (opposite winding order)
    uiCtx.moveTo(displayPts[0].x, displayPts[0].y);
    uiCtx.lineTo(displayPts[3].x, displayPts[3].y);
    uiCtx.lineTo(displayPts[2].x, displayPts[2].y);
    uiCtx.lineTo(displayPts[1].x, displayPts[1].y);
    uiCtx.closePath();

    uiCtx.fill('evenodd');

    // Draw lines
    uiCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    uiCtx.lineWidth = 2;
    uiCtx.beginPath();
    uiCtx.moveTo(displayPts[0].x, displayPts[0].y);
    uiCtx.lineTo(displayPts[1].x, displayPts[1].y);
    uiCtx.lineTo(displayPts[2].x, displayPts[2].y);
    uiCtx.lineTo(displayPts[3].x, displayPts[3].y);
    uiCtx.closePath();
    uiCtx.stroke();

    // Draw handles
    displayPts.forEach((pt, i) => {
        uiCtx.beginPath();
        uiCtx.arc(pt.x, pt.y, 16, 0, Math.PI * 2);
        uiCtx.fillStyle = (i === dragIndex) ? '#4f8ef7' : 'white';
        uiCtx.fill();
        uiCtx.lineWidth = 2;
        uiCtx.strokeStyle = '#333';
        uiCtx.stroke();
    });
}

// --- Interaction ---

function getPointerPos(e) {
    if (e.touches) {
        return { x: e.touches[0].clientX - canvasRect.left, y: e.touches[0].clientY - canvasRect.top };
    }
    return { x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top };
}

function displayToNormalised(x, y) {
    const editorCanvas = document.getElementById('editor-canvas');
    const w = uiCanvas.width;
    const h = uiCanvas.height;

    const imgRatio = editorCanvas.width / editorCanvas.height;
    const containerRatio = w / h;

    let imgDisplayW, imgDisplayH, offsetX = 0, offsetY = 0;

    if (imgRatio > containerRatio) {
        imgDisplayW = w;
        imgDisplayH = w / imgRatio;
        offsetY = (h - imgDisplayH) / 2;
    } else {
        imgDisplayH = h;
        imgDisplayW = h * imgRatio;
        offsetX = (w - imgDisplayW) / 2;
    }

    return {
        x: Math.max(0, Math.min(1, (x - offsetX) / imgDisplayW)),
        y: Math.max(0, Math.min(1, (y - offsetY) / imgDisplayH))
    };
}

function handleDown(e) {
    const pos = getPointerPos(e);

    // Find closest handle in display space
    const editorCanvas = document.getElementById('editor-canvas');
    const w = uiCanvas.width;
    const h = uiCanvas.height;

    const imgRatio = editorCanvas.width / editorCanvas.height;
    const containerRatio = w / h;
    let imgDisplayW, imgDisplayH, offsetX = 0, offsetY = 0;
    if (imgRatio > containerRatio) {
        imgDisplayW = w; imgDisplayH = w / imgRatio; offsetY = (h - imgDisplayH) / 2;
    } else {
        imgDisplayH = h; imgDisplayW = h * imgRatio; offsetX = (w - imgDisplayW) / 2;
    }

    let minDist = 30; // hit radius
    dragIndex = -1;

    handles.forEach((handle, i) => {
        const hx = offsetX + handle.x * imgDisplayW;
        const hy = offsetY + handle.y * imgDisplayH;
        const dist = Math.hypot(pos.x - hx, pos.y - hy);
        if (dist < minDist) {
            minDist = dist;
            dragIndex = i;
        }
    });

    if (dragIndex !== -1) {
        isDragging = true;
        drawCropUI();
    }
}

function handleMove(e) {
    if (!isDragging || dragIndex === -1) return;

    const pos = getPointerPos(e);
    const norm = displayToNormalised(pos.x, pos.y);

    handles[dragIndex] = norm;
    drawCropUI();
}

function handleUp() {
    if (isDragging) {
        isDragging = false;
        dragIndex = -1;
        drawCropUI();
    }
}

function handleTouchDown(e) { e.preventDefault(); handleDown(e); }
function handleTouchMove(e) { e.preventDefault(); handleMove(e); }


// --- Perspective Transform Mathematics ---

/**
 * Solves Ax = b using Gaussian elimination with partial pivoting.
 */
function gaussianElimination(A, b) {
    const n = A.length;

    for (let i = 0; i < n; i++) {
        // Pivot
        let maxRow = i;
        for (let k = i + 1; k < n; k++) {
            if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
                maxRow = k;
            }
        }

        // Swap
        [A[i], A[maxRow]] = [A[maxRow], A[i]];
        [b[i], b[maxRow]] = [b[maxRow], b[i]];

        // Eliminate
        for (let k = i + 1; k < n; k++) {
            const factor = A[k][i] / A[i][i];
            for (let j = i; j < n; j++) {
                A[k][j] -= factor * A[i][j];
            }
            b[k] -= factor * b[i];
        }
    }

    // Back substitution
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
        let sum = 0;
        for (let j = i + 1; j < n; j++) {
            sum += A[i][j] * x[j];
        }
        x[i] = (b[i] - sum) / A[i][i];
    }

    return x;
}

/**
 * Computes Homography matrix using DLT.
 */
function computeHomography(src, dst) {
    const A = [];
    const b = [];

    for (let i = 0; i < 4; i++) {
        const { x, y } = src[i];
        const { x: u, y: v } = dst[i];

        A.push([x, y, 1, 0, 0, 0, -u*x, -u*y]);
        b.push(u);

        A.push([0, 0, 0, x, y, 1, -v*x, -v*y]);
        b.push(v);
    }

    const h = gaussianElimination(A, b);
    return [
        [h[0], h[1], h[2]],
        [h[3], h[4], h[5]],
        [h[6], h[7], 1]
    ];
}

/**
 * Inverts a 3x3 matrix.
 */
function invertMatrix3x3(M) {
    const det = M[0][0]*(M[1][1]*M[2][2] - M[2][1]*M[1][2]) -
                M[0][1]*(M[1][0]*M[2][2] - M[1][2]*M[2][0]) +
                M[0][2]*(M[1][0]*M[2][1] - M[1][1]*M[2][0]);

    const invDet = 1 / det;

    return [
        [
            (M[1][1]*M[2][2] - M[2][1]*M[1][2]) * invDet,
            (M[0][2]*M[2][1] - M[0][1]*M[2][2]) * invDet,
            (M[0][1]*M[1][2] - M[0][2]*M[1][1]) * invDet
        ],
        [
            (M[1][2]*M[2][0] - M[1][0]*M[2][2]) * invDet,
            (M[0][0]*M[2][2] - M[0][2]*M[2][0]) * invDet,
            (M[1][0]*M[0][2] - M[0][0]*M[1][2]) * invDet
        ],
        [
            (M[1][0]*M[2][1] - M[2][0]*M[1][1]) * invDet,
            (M[2][0]*M[0][1] - M[0][0]*M[2][1]) * invDet,
            (M[0][0]*M[1][1] - M[1][0]*M[0][1]) * invDet
        ]
    ];
}

/**
 * Bilinear interpolation for sampling.
 */
function sampleBilinear(data, width, height, x, y) {
    const x0 = Math.floor(x);
    const x1 = Math.min(x0 + 1, width - 1);
    const y0 = Math.floor(y);
    const y1 = Math.min(y0 + 1, height - 1);

    const dx = x - x0;
    const dy = y - y0;

    const idx00 = (y0 * width + x0) * 4;
    const idx10 = (y0 * width + x1) * 4;
    const idx01 = (y1 * width + x0) * 4;
    const idx11 = (y1 * width + x1) * 4;

    const result = [0, 0, 0, 255];
    for (let c = 0; c < 3; c++) {
        const top = data[idx00 + c] * (1 - dx) + data[idx10 + c] * dx;
        const bottom = data[idx01 + c] * (1 - dx) + data[idx11 + c] * dx;
        result[c] = top * (1 - dy) + bottom * dy;
    }
    return result;
}

export async function applyPerspectiveTransform(sourceCanvas, cornersNorm) {
    const sw = sourceCanvas.width;
    const sh = sourceCanvas.height;

    // Scale normalised corners to actual source image pixels
    const srcPts = cornersNorm.map(p => ({ x: p.x * sw, y: p.y * sh }));

    // Compute dimensions of output (bounding box of transformed polygon)
    // Estimate width/height using max edge lengths
    const w1 = Math.hypot(srcPts[1].x - srcPts[0].x, srcPts[1].y - srcPts[0].y);
    const w2 = Math.hypot(srcPts[2].x - srcPts[3].x, srcPts[2].y - srcPts[3].y);
    const dw = Math.max(w1, w2);

    const h1 = Math.hypot(srcPts[3].x - srcPts[0].x, srcPts[3].y - srcPts[0].y);
    const h2 = Math.hypot(srcPts[2].x - srcPts[1].x, srcPts[2].y - srcPts[1].y);
    const dh = Math.max(h1, h2);

    const dstW = Math.round(dw);
    const dstH = Math.round(dh);

    const dstPts = [
        { x: 0, y: 0 },
        { x: dstW, y: 0 },
        { x: dstW, y: dstH },
        { x: 0, y: dstH }
    ];

    // Compute Homography dst -> src for backward mapping
    // We compute H: src -> dst, then invert it
    const H_fwd = computeHomography(srcPts, dstPts);
    const H_inv = invertMatrix3x3(H_fwd);

    const srcCtx = sourceCanvas.getContext('2d');
    const srcImageData = srcCtx.getImageData(0, 0, sw, sh);
    const srcData = srcImageData.data;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = dstW;
    outCanvas.height = dstH;
    const outCtx = outCanvas.getContext('2d');
    const outImageData = outCtx.createImageData(dstW, dstH);
    const outData = outImageData.data;

    // Apply transform (backward mapping)
    for (let y = 0; y < dstH; y++) {
        for (let x = 0; x < dstW; x++) {
            // Apply H_inv
            let sx = H_inv[0][0]*x + H_inv[0][1]*y + H_inv[0][2];
            let sy = H_inv[1][0]*x + H_inv[1][1]*y + H_inv[1][2];
            const w = H_inv[2][0]*x + H_inv[2][1]*y + H_inv[2][2];

            sx /= w;
            sy /= w;

            const outIdx = (y * dstW + x) * 4;

            if (sx >= 0 && sx < sw - 1 && sy >= 0 && sy < sh - 1) {
                const color = sampleBilinear(srcData, sw, sh, sx, sy);
                outData[outIdx] = color[0];
                outData[outIdx+1] = color[1];
                outData[outIdx+2] = color[2];
                outData[outIdx+3] = 255;
            } else {
                // Out of bounds
                outData[outIdx] = 0;
                outData[outIdx+1] = 0;
                outData[outIdx+2] = 0;
                outData[outIdx+3] = 255;
            }
        }
    }

    outCtx.putImageData(outImageData, 0, 0);
    return outCanvas;
}
