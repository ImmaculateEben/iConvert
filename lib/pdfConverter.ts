import { PdfToImageSettings } from './types';

/**
 * Load PDF.js library dynamically
 */
async function getPdfJs() {
  const pdfjsModule = await import('pdfjs-dist');
  const pdfjsLib = pdfjsModule.default || pdfjsModule;
  
  // Get existing GlobalWorkerOptions and set workerSrc
  const version = (pdfjsLib as any).version || '4.0.379';
  try {
    // Access the existing getter property and set workerSrc on the returned object
    const workerOptions = (pdfjsLib as any).GlobalWorkerOptions;
    if (workerOptions) {
      workerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;
    }
  } catch (e) {
    // If that fails, use Object.defineProperty to override (for older versions)
    Object.defineProperty(pdfjsLib, 'GlobalWorkerOptions', {
      value: { workerSrc: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js` },
      writable: true,
      configurable: true,
    });
  }
  
  return pdfjsLib;
}

/**
 * Get page numbers to process based on settings
 */
function getPageNumbers(totalPages: number, settings: PdfToImageSettings): number[] {
  if (settings.pageRange === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  
  if (settings.customPages) {
    const pages: number[] = [];
    const parts = settings.customPages.split(',');
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-').map(Number);
        for (let i = start; i <= end; i++) {
          if (i >= 1 && i <= totalPages) {
            pages.push(i);
          }
        }
      } else {
        const page = Number(trimmed);
        if (page >= 1 && page <= totalPages) {
          pages.push(page);
        }
      }
    }
    
    const uniquePages = Array.from(new Set(pages));
    return uniquePages.sort((a, b) => a - b);
  }
  
  return Array.from({ length: totalPages }, (_, i) => i + 1);
}

/**
 * Convert a PDF page to image
 */
async function convertPage(
  page: any,
  pageNumber: number,
  settings: PdfToImageSettings,
  filename: string
): Promise<{ blob: Blob; filename: string; pageNumber: number }> {
  const { scale, outputFormat, quality } = settings;
  
  // Get viewport at the desired scale
  const viewport = page.getViewport({ scale });
  
  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  
  // Render PDF page to canvas
  const renderContext: any = {
    canvasContext: ctx,
    viewport,
  };
  
  const renderTask = page.render(renderContext);
  await renderTask.promise;
  
  // Convert canvas to blob
  const mimeType = outputFormat === 'png' ? 'image/png' : 'image/jpeg';
  const qualityValue = outputFormat === 'jpeg' ? quality : undefined;
  
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to convert page to image'));
      },
      mimeType,
      qualityValue
    );
  });
  
  // Generate filename
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  const extension = outputFormat === 'jpeg' ? 'jpg' : 'png';
  const paddedPage = pageNumber.toString().padStart(3, '0');
  const outputFilename = `${nameWithoutExt}_page_${paddedPage}.${extension}`;
  
  return {
    blob,
    filename: outputFilename,
    pageNumber,
  };
}

/**
 * Convert PDF to images
 */
export async function convertPdfToImages(
  file: File,
  settings: PdfToImageSettings,
  onProgress?: (completed: number, total: number) => void
): Promise<{ blob: Blob; filename: string; pageNumber: number }[]> {
  // Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();
  
  // Load PDF.js
  const pdfjs = await getPdfJs();
  
  // Load PDF document
  const loadingTask = (pdfjs as any).getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;
  
  // Get pages to process
  const pageNumbers = getPageNumbers(totalPages, settings);
  const results: { blob: Blob; filename: string; pageNumber: number }[] = [];
  
  // Process pages sequentially to manage memory
  for (let i = 0; i < pageNumbers.length; i++) {
    const pageNumber = pageNumbers[i];
    const page = await pdfDoc.getPage(pageNumber);
    
    const result = await convertPage(page, pageNumber, settings, file.name);
    results.push(result);
    
    onProgress?.(i + 1, pageNumbers.length);
  }
  
  // Destroy document to free memory
  pdfDoc.destroy();
  
  return results;
}

/**
 * Get number of pages in PDF (without full conversion)
 */
export async function getPdfPageCount(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjs = await getPdfJs();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  const count = pdfDoc.numPages;
  pdfDoc.destroy();
  return count;
}
