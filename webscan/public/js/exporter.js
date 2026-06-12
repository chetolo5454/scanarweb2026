export async function downloadAsJpeg(canvas, filename) {
    return new Promise((resolve, reject) => {
        try {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Canvas to Blob failed'));
                    return;
                }
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename || 'document.jpg';
                document.body.appendChild(a);
                a.click();

                // Cleanup
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    resolve();
                }, 100);
            }, 'image/jpeg', 0.9);
        } catch (e) {
            reject(e);
        }
    });
}

export async function downloadAsPdf(canvasArray, filename) {
    if (!canvasArray || canvasArray.length === 0) return;

    // Check if jsPDF is loaded
    if (!window.jspdf || !window.jspdf.jsPDF) {
        throw new Error('jsPDF library not loaded');
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < canvasArray.length; i++) {
        const canvas = canvasArray[i];

        // Add new page if not the first image
        if (i > 0) {
            pdf.addPage();
        }

        // Calculate proportional dimensions to fit A4
        const imgRatio = canvas.width / canvas.height;
        const pdfRatio = pdfWidth / pdfHeight;

        let finalW, finalH;

        if (imgRatio > pdfRatio) {
            // Fits width
            finalW = pdfWidth;
            finalH = pdfWidth / imgRatio;
        } else {
            // Fits height
            finalH = pdfHeight;
            finalW = pdfHeight * imgRatio;
        }

        // Center on page
        const x = (pdfWidth - finalW) / 2;
        const y = (pdfHeight - finalH) / 2;

        try {
            const imgData = canvas.toDataURL('image/jpeg', 0.85);
            pdf.addImage(imgData, 'JPEG', x, y, finalW, finalH);
        } catch (err) {
            // we'll rely on global error logging or alert at caller
            throw err;
        }
    }

    pdf.save(filename || 'document.pdf');
}
