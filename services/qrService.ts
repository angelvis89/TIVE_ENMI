declare const jsQR: any;
declare const QRCode: any;

/**
 * Decodes a QR code from a base64 image string (without data prefix).
 * Uses the jsQR library for deterministic, verifiable results.
 */
export const scanQRFromBase64 = (base64Data: string): Promise<string | null> => {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) {
        resolve(null);
        return;
      }

      canvas.width = image.width;
      canvas.height = image.height;
      context.drawImage(image, 0, 0);

      // Get raw pixel data for the QR scanner
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      
      // Attempt to find code
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code) {
        resolve(code.data);
      } else {
        // Try again with inversion if failed first time (dark on light vs light on dark)
        const codeInverted = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "attemptBoth",
        });
        resolve(codeInverted ? codeInverted.data : null);
      }
    };
    
    image.onerror = () => resolve(null);
    
    // Re-add prefix for Image object
    image.src = `data:image/jpeg;base64,${base64Data}`;
  });
};

/**
 * Generates a Base64 PNG image of a QR code from text.
 * Used to embed the QR into the generated PDF.
 */
export const generateQRImageBase64 = (text: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        try {
            const container = document.createElement('div');
            // Using QRCode.js to render to the hidden container
            new QRCode(container, {
                text: text,
                width: 200, // Higher resolution for print
                height: 200,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M // Medium error correction
            });

            // Wait briefly for the library to render the img tag
            setTimeout(() => {
                const img = container.querySelector('img');
                if (img && img.src) {
                    resolve(img.src);
                } else {
                    // Fallback: sometimes it renders a canvas
                    const canvas = container.querySelector('canvas');
                    if (canvas) {
                        resolve(canvas.toDataURL('image/png'));
                    } else {
                        reject(new Error("QR generation failed: No image created"));
                    }
                }
            }, 100);
        } catch (e) {
            reject(e);
        }
    });
};