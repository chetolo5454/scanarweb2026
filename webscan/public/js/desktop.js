import { socketClient } from './socket-client.js';
import { logInfo, logError } from './app.js';

// Application State
const state = {
    pages: [], // Array of { id, originalData, editedData, filter }
    selectedPageIndex: -1,
    isCropMode: false,
    cropCorners: null
};

// DOM Elements - Views
const view1 = document.getElementById('desktop-view-1');
const view2 = document.getElementById('desktop-view-2');
const view3 = document.getElementById('desktop-view-3');

// DOM Elements - View 2
const captureStrip = document.getElementById('capture-strip');
const captureLargePreview = document.getElementById('capture-large-preview');
const captureEmptyState = document.getElementById('capture-empty-state');
const pageCount = document.getElementById('page-count');
const btnDoneScanning = document.getElementById('btn-done-scanning');

// DOM Elements - View 3
const editSidebar = document.getElementById('edit-sidebar');
const editorCanvas = document.getElementById('editor-canvas');
const editorContainer = document.getElementById('editor-container');
const btnCrop = document.getElementById('btn-crop');
const filterSelect = document.getElementById('filter-select');
const btnUndo = document.getElementById('btn-undo');
const btnDeletePage = document.getElementById('btn-delete-page');
const btnDownloadPdf = document.getElementById('btn-download-pdf');
const btnDownloadJpeg = document.getElementById('btn-download-jpeg');
const btnNewScan = document.getElementById('btn-new-scan');

// Dynamically loaded modules
let perspectiveModule = null;
let filtersModule = null;
let exporterModule = null;

export async function initDesktop() {
    logInfo('[Desktop] Init');

    // Setup View 1 QR Code and URL
    let url;
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        url = config.localUrl;
    } catch (err) {
        logError('[Desktop] Failed to fetch config, falling back to window.location', err);
        url = window.location.origin;
    }
    document.getElementById('local-url').textContent = url;

    new QRCode(document.getElementById("qrcode"), {
        text: url,
        width: 200,
        height: 200,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });

    // Bind Event Listeners
    btnDoneScanning.addEventListener('click', goToEditView);
    btnNewScan.addEventListener('click', resetSession);

    // Edit toolbar listeners
    btnCrop.addEventListener('click', toggleCropMode);
    filterSelect.addEventListener('change', handleFilterChange);
    btnUndo.addEventListener('click', handleUndo);
    btnDeletePage.addEventListener('click', handleDeleteSelectedPage);

    // Export listeners
    btnDownloadPdf.addEventListener('click', handleDownloadPdf);
    btnDownloadJpeg.addEventListener('click', handleDownloadJpeg);

    // Socket Listeners
    socketClient.on('session:mobile_connected', handleMobileConnected);
    socketClient.on('photo:captured', handlePhotoCaptured);
    socketClient.on('session:done', handleSessionDone);

    // Setup drag/drop for View 2 thumbnails
    setupDragAndDrop(captureStrip, updateOrderView2);
}

// --- Navigation ---

function switchView(fromView, toView) {
    fromView.classList.remove('active-view');
    setTimeout(() => {
        fromView.classList.add('hidden');
        toView.classList.remove('hidden');
        // Force reflow
        void toView.offsetWidth;
        toView.classList.add('active-view');
    }, 200); // match CSS transition
}

function handleMobileConnected(data) {
    logInfo('[Desktop] Mobile connected:', data.socketId);
    if (view1.classList.contains('active-view')) {
        switchView(view1, view2);
    }
}

function handleSessionDone() {
    if (view2.classList.contains('active-view') && state.pages.length > 0) {
        goToEditView();
    }
}

function resetSession() {
    state.pages = [];
    state.selectedPageIndex = -1;
    captureStrip.innerHTML = '';
    captureLargePreview.style.display = 'none';
    captureEmptyState.style.display = 'block';
    updatePageCount();

    switchView(view3, view1);
}

// --- View 2: Live Capture ---

function handlePhotoCaptured(data) {
    logInfo('[Desktop] Photo received');

    const pageId = `page_${Date.now()}`;
    const pageData = {
        id: pageId,
        originalData: data.imageData,
        editedData: data.imageData,
        filter: 'none'
    };

    state.pages.push(pageData);
    const index = state.pages.length - 1;

    renderThumbnailView2(pageData, index);
    showLargePreviewView2(pageData.originalData);
    updatePageCount();

    // Acknowledge receipt back to mobile
    socketClient.emit('capture:confirm', { pageIndex: index });
}

function renderThumbnailView2(page, index) {
    const item = document.createElement('div');
    item.className = 'thumbnail-item';
    item.draggable = true;
    item.dataset.id = page.id;

    item.innerHTML = `
        <span class="thumbnail-number">${index + 1}</span>
        <img class="thumbnail-img" src="${page.editedData}" alt="Page ${index + 1}">
        <button class="thumbnail-delete" title="Delete">×</button>
    `;

    item.addEventListener('click', (e) => {
        if (e.target.classList.contains('thumbnail-delete')) {
            deletePageById(page.id);
        } else {
            showLargePreviewView2(page.editedData);
            // Update active state visually
            document.querySelectorAll('#capture-strip .thumbnail-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
        }
    });

    captureStrip.appendChild(item);

    // Make it active
    document.querySelectorAll('#capture-strip .thumbnail-item').forEach(el => el.classList.remove('active'));
    item.classList.add('active');
}

function showLargePreviewView2(imgData) {
    captureEmptyState.style.display = 'none';
    captureLargePreview.src = imgData;
    captureLargePreview.style.display = 'block';
}

function updatePageCount() {
    pageCount.textContent = state.pages.length;
    btnDoneScanning.disabled = state.pages.length === 0;
}

function deletePageById(id) {
    const index = state.pages.findIndex(p => p.id === id);
    if (index > -1) {
        state.pages.splice(index, 1);

        // Remove from DOM
        const el = captureStrip.querySelector(`[data-id="${id}"]`);
        if (el) el.remove();

        // Update numbers
        updateNumbersView2();
        updatePageCount();

        // Update large preview
        if (state.pages.length > 0) {
            showLargePreviewView2(state.pages[state.pages.length - 1].editedData);
            captureStrip.lastElementChild.classList.add('active');
        } else {
            captureLargePreview.style.display = 'none';
            captureEmptyState.style.display = 'block';
        }
    }
}

function updateNumbersView2() {
    const items = captureStrip.querySelectorAll('.thumbnail-item');
    items.forEach((item, idx) => {
        item.querySelector('.thumbnail-number').textContent = idx + 1;
    });
}

function updateOrderView2() {
    const items = Array.from(captureStrip.querySelectorAll('.thumbnail-item'));
    const newPages = [];

    items.forEach((item, idx) => {
        const id = item.dataset.id;
        const page = state.pages.find(p => p.id === id);
        if (page) newPages.push(page);
        item.querySelector('.thumbnail-number').textContent = idx + 1;
    });

    state.pages = newPages;
}

// --- Drag and Drop Utility ---
function setupDragAndDrop(container, onReorder) {
    let draggedItem = null;

    container.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('thumbnail-item')) {
            draggedItem = e.target;
            setTimeout(() => e.target.style.opacity = '0.5', 0);
        }
    });

    container.addEventListener('dragend', (e) => {
        if (draggedItem) {
            draggedItem.style.opacity = '1';
            draggedItem = null;
            onReorder();
        }
    });

    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(container, e.clientY);
        const draggable = document.querySelector('.thumbnail-item[style*="opacity: 0.5"]');
        if (draggable) {
            if (afterElement == null) {
                container.appendChild(draggable);
            } else {
                container.insertBefore(draggable, afterElement);
            }
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.thumbnail-item:not([style*="opacity: 0.5"])')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}


// --- View 3: Edit & Export ---

async function goToEditView() {
    if (state.pages.length === 0) return;

    // Lazy load heavy modules
    if (!perspectiveModule) perspectiveModule = await import('./perspective.js');
    if (!filtersModule) filtersModule = await import('./filters.js');
    if (!exporterModule) exporterModule = await import('./exporter.js');

    renderSidebarView3();
    selectPage(0);
    switchView(view2, view3);
}

function renderSidebarView3() {
    editSidebar.innerHTML = '';
    state.pages.forEach((page, index) => {
        const item = document.createElement('div');
        item.className = 'thumbnail-item';
        item.dataset.index = index;

        item.innerHTML = `
            <span class="thumbnail-number">${index + 1}</span>
            <img class="thumbnail-img" src="${page.editedData}" alt="Page ${index + 1}">
        `;

        item.addEventListener('click', () => selectPage(index));
        editSidebar.appendChild(item);
    });
}

async function selectPage(index) {
    if (index < 0 || index >= state.pages.length) return;

    // Save current crop state if active
    if (state.isCropMode) {
        await exitCropMode(false); // cancel crop on switch
    }

    state.selectedPageIndex = index;
    const page = state.pages[index];

    // Update sidebar visual state
    document.querySelectorAll('#edit-sidebar .thumbnail-item').forEach(el => el.classList.remove('active'));
    editSidebar.querySelector(`[data-index="${index}"]`).classList.add('active');

    // Update toolbar
    filterSelect.value = page.filter;

    // Render to canvas
    await drawToEditorCanvas(page.editedData);
}

async function drawToEditorCanvas(imgDataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            editorCanvas.width = img.width;
            editorCanvas.height = img.height;
            const ctx = editorCanvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve();
        };
        img.onerror = reject;
        img.src = imgDataUrl;
    });
}

// --- Editing Tools ---

async function toggleCropMode() {
    if (state.selectedPageIndex === -1) return;

    if (state.isCropMode) {
        await exitCropMode(true); // Apply crop
    } else {
        await enterCropMode();
    }
}

async function enterCropMode() {
    state.isCropMode = true;
    btnCrop.classList.add('active');
    btnCrop.textContent = 'Apply Crop';

    // Load original image to crop from
    const page = state.pages[state.selectedPageIndex];
    await drawToEditorCanvas(page.originalData);

    perspectiveModule.initCropUI(editorCanvas, editorContainer);
}

async function exitCropMode(apply) {
    if (!state.isCropMode) return;

    const corners = perspectiveModule.getCropCorners();
    perspectiveModule.destroyCropUI();

    state.isCropMode = false;
    btnCrop.classList.remove('active');
    btnCrop.textContent = 'Perspective Crop';

    if (apply && corners) {
        try {
            // Apply perspective transform
            const page = state.pages[state.selectedPageIndex];

            // 1. Load original to a source canvas
            const sourceCanvas = document.createElement('canvas');
            const img = new Image();
            await new Promise((resolve) => { img.onload = resolve; img.src = page.originalData; });
            sourceCanvas.width = img.width;
            sourceCanvas.height = img.height;
            sourceCanvas.getContext('2d').drawImage(img, 0, 0);

            // 2. Perform transform
            const resultCanvas = await perspectiveModule.applyPerspectiveTransform(sourceCanvas, corners);

            // 3. Update originalData with cropped version so filters apply to crop
            page.originalData = resultCanvas.toDataURL('image/jpeg', 0.9);

            // 4. Re-apply current filter
            await applyCurrentFilter();

        } catch (err) {
            logError('[Desktop] Crop error:', err);
            alert('Failed to apply crop.');
            await drawToEditorCanvas(state.pages[state.selectedPageIndex].editedData);
        }
    } else {
        // Cancelled, restore edited data
        await drawToEditorCanvas(state.pages[state.selectedPageIndex].editedData);
    }
}

async function handleFilterChange(e) {
    if (state.selectedPageIndex === -1 || state.isCropMode) return;

    const filter = e.target.value;
    state.pages[state.selectedPageIndex].filter = filter;

    await applyCurrentFilter();
}

async function applyCurrentFilter() {
    const page = state.pages[state.selectedPageIndex];

    if (page.filter === 'none') {
        page.editedData = page.originalData;
    } else {
        try {
            // Load source (which might be cropped)
            const sourceCanvas = document.createElement('canvas');
            const img = new Image();
            await new Promise((resolve) => { img.onload = resolve; img.src = page.originalData; });
            sourceCanvas.width = img.width;
            sourceCanvas.height = img.height;
            sourceCanvas.getContext('2d').drawImage(img, 0, 0);

            // Apply filter
            const resultCanvas = await filtersModule.applyFilter(sourceCanvas, page.filter);
            page.editedData = resultCanvas.toDataURL('image/jpeg', 0.9);
        } catch (err) {
            logError('[Desktop] Filter error:', err);
            alert('Failed to apply filter.');
        }
    }

    // Update UI
    await drawToEditorCanvas(page.editedData);
    updateSidebarThumbnail(state.selectedPageIndex);
}

function updateSidebarThumbnail(index) {
    const item = editSidebar.querySelector(`[data-index="${index}"]`);
    if (item) {
        item.querySelector('img').src = state.pages[index].editedData;
    }
}

async function handleUndo() {
    if (state.selectedPageIndex === -1) return;
    const page = state.pages[state.selectedPageIndex];

    // Reset to none filter
    page.filter = 'none';
    filterSelect.value = 'none';
    page.editedData = page.originalData;

    await drawToEditorCanvas(page.editedData);
    updateSidebarThumbnail(state.selectedPageIndex);
}

function handleDeleteSelectedPage() {
    if (state.selectedPageIndex === -1) return;

    if (confirm('Delete this page?')) {
        state.pages.splice(state.selectedPageIndex, 1);
        renderSidebarView3();

        if (state.pages.length === 0) {
            resetSession();
        } else {
            // Select previous page or first page
            const newIndex = Math.max(0, state.selectedPageIndex - 1);
            selectPage(newIndex);
        }
    }
}

// --- Exports ---

async function handleDownloadPdf() {
    if (state.pages.length === 0) return;

    const btn = btnDownloadPdf;
    const originalText = btn.textContent;
    btn.textContent = 'Generating PDF...';
    btn.disabled = true;

    try {
        const canvases = await Promise.all(state.pages.map(async page => {
            const canvas = document.createElement('canvas');
            const img = new Image();
            await new Promise((resolve) => { img.onload = resolve; img.src = page.editedData; });
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext('2d').drawImage(img, 0, 0);
            return canvas;
        }));

        await exporterModule.downloadAsPdf(canvases, `WebScan_${Date.now()}.pdf`);
    } catch (err) {
        logError('[Desktop] PDF Export error:', err);
        alert('Failed to generate PDF.');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

async function handleDownloadJpeg() {
    if (state.selectedPageIndex === -1) return;

    try {
        await exporterModule.downloadAsJpeg(editorCanvas, `WebScan_Page_${state.selectedPageIndex + 1}.jpg`);
    } catch (err) {
        logError('[Desktop] JPEG Export error:', err);
        alert('Failed to save JPEG.');
    }
}
