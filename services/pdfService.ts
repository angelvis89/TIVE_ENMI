declare const pdfjsLib: any;

export const convertPdfToImage = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async function () {
      try {
        const typedarray = new Uint8Array(this.result as ArrayBuffer);
        
        // Load the PDF file
        const loadingTask = pdfjsLib.getDocument({ data: typedarray });
        const pdf = await loadingTask.promise;

        // Fetch the first page
        const pageNumber = 1;
        const page = await pdf.getPage(pageNumber);

        const scale = 2.0; // Higher scale for better OCR/Vision resolution
        const viewport = page.getViewport({ scale });

        // Prepare canvas using PDF page dimensions
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (!context) {
          reject("Could not create canvas context");
          return;
        }

        // Render PDF page into canvas context
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };
        
        await page.render(renderContext).promise;

        // Convert canvas to base64 image URL (JPEG for slightly smaller size than PNG)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        
        // Remove the "data:image/jpeg;base64," prefix for Gemini API
        const base64Data = dataUrl.split(',')[1];
        resolve(base64Data);

      } catch (error) {
        reject(error);
      }
    };
    reader.readAsArrayBuffer(file);
  });
};

export const embedQrInPdf = async (pdfFile: Blob, qrImageBase64: string): Promise<Uint8Array> => {
    const PDFLib = (window as any).PDFLib;
    if (!PDFLib) throw new Error("PDF-Lib library not loaded");

    const pdfBytes = await pdfFile.arrayBuffer();
    const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
    
    const qrImageBytes = await fetch(qrImageBase64).then(res => res.arrayBuffer());
    const qrImage = await pdfDoc.embedPng(qrImageBytes);

    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    
    // Get page dimensions to calculate position
    const { height } = firstPage.getSize();

    // Position logic: "Top Left"
    // PDF coordinates start at bottom-left (0,0).
    // Top left of A4 is roughly (0, 842).
    // Based on the TIV template, the QR is roughly at:
    // Left: 13% of width (~70-80pts)
    // Top: 8% from top (~60-70pts down)
    
    // 65 points from left, 80 points from top
    const x = 65; 
    const y = height - 85; // Subtract from height to go down from top
    const size = 60; // Width/Height of QR

    firstPage.drawImage(qrImage, {
        x: x,
        y: y - size, // y is the bottom-left corner of the image
        width: size,
        height: size,
    });

    const pdfBytesModified = await pdfDoc.save();
    return pdfBytesModified;
};