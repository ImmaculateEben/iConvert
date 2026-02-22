import { PdfOrganizeSettings } from './types';

// PDF.js and pdf-lib will be loaded dynamically
let pdfjsLib: any = null;
let pdfLib: any = null;

async function getPdfJs() {
  if (!pdfjsLib) {
    const module = await import('pdfjs-dist');
    pdfjsLib = module.default || module;
    
    // Set up worker
    const version = pdfjsLib.version || '3.11.174';
    try {
      const workerOptions = (pdfjsLib as any).GlobalWorkerOptions;
      if (workerOptions) {
        workerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;
      }
    } catch (e) {
      Object.defineProperty(pdfjsLib, 'GlobalWorkerOptions', {
        value: { workerSrc: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js` },
        writable: true,
        configurable: true,
      });
    }
  }
  return pdfjsLib;
}

async function getPdfLib() {
  if (!pdfLib) {
    const module = await import('pdf-lib');
    pdfLib = module;
  }
  return pdfLib;
}

export interface PdfPage {
  pageNumber: number;
  originalPageNumber: number;
  rotation: number;
  thumbnail?: string;
}

export interface OrganizeResult {
  blob: Blob;
  filename: string;
  pageCount: number;
}

/**
 * Load a PDF file and extract page thumbnails
 */
export async function loadPdfPages(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<PdfPage[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjs = await getPdfJs();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const pages: PdfPage[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 0.5 });

    // Create canvas for thumbnail
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) continue;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    const thumbnail = canvas.toDataURL('image/jpeg', 0.8);

    pages.push({
      pageNumber: i,
      originalPageNumber: i,
      rotation: 0,
      thumbnail,
    });

    if (onProgress) {
      onProgress(i, numPages);
    }
  }

  return pages;
}

/**
 * Apply all changes and save the PDF
 */
export async function applyOrganizeChanges(
  file: File,
  pages: PdfPage[],
  settings: PdfOrganizeSettings
): Promise<OrganizeResult> {
  const arrayBuffer = await file.arrayBuffer();
  const { PDFDocument, degrees } = await getPdfLib();
  
  const srcDoc = await PDFDocument.load(arrayBuffer);
  const newDoc = await PDFDocument.create();

  // Reorder pages according to new order
  const copiedPages = await newDoc.copyPages(srcDoc, pages.map(p => p.originalPageNumber - 1));
  
  for (let i = 0; i < copiedPages.length; i++) {
    const page = copiedPages[i];
    newDoc.addPage(page);
    
    if (pages[i].rotation !== 0) {
      const currentRotation = page.getRotation().angle;
      page.setRotation(degrees(currentRotation + pages[i].rotation));
    }
  }

  const pdfBytes = await newDoc.save({ useObjectStreams: false });
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });

  const baseName = file.name.replace(/\.pdf$/i, '');
  return {
    blob,
    filename: `${baseName}_organized.pdf`,
    pageCount: pages.length,
  };
}

/**
 * Delete selected pages from PDF
 */
export async function deletePages(
  file: File,
  pagesToDelete: number[],
  settings: PdfOrganizeSettings
): Promise<OrganizeResult> {
  const arrayBuffer = await file.arrayBuffer();
  const { PDFDocument } = await getPdfLib();
  
  const srcDoc = await PDFDocument.load(arrayBuffer);
  const numPages = srcDoc.getPageCount();
  
  const pagesToKeep: number[] = [];
  for (let i = 0; i < numPages; i++) {
    if (!pagesToDelete.includes(i + 1)) {
      pagesToKeep.push(i);
    }
  }

  const newDoc = await PDFDocument.create();
  const copiedPages = await newDoc.copyPages(srcDoc, pagesToKeep);
  
  for (const page of copiedPages) {
    newDoc.addPage(page);
  }

  const pdfBytes = await newDoc.save({ useObjectStreams: false });
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });

  const baseName = file.name.replace(/\.pdf$/i, '');
  return {
    blob,
    filename: `${baseName}_reduced.pdf`,
    pageCount: pagesToKeep.length,
  };
}

/**
 * Extract selected pages as new PDF
 */
export async function extractPages(
  file: File,
  pagesToExtract: number[],
  settings: PdfOrganizeSettings
): Promise<OrganizeResult> {
  const arrayBuffer = await file.arrayBuffer();
  const { PDFDocument } = await getPdfLib();
  
  const srcDoc = await PDFDocument.load(arrayBuffer);
  const newDoc = await PDFDocument.create();

  const pageIndices = pagesToExtract.map(p => p - 1).filter(p => p >= 0);
  const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);

  for (const page of copiedPages) {
    newDoc.addPage(page);
  }

  const pdfBytes = await newDoc.save({ useObjectStreams: false });
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });

  const baseName = file.name.replace(/\.pdf$/i, '');
  return {
    blob,
    filename: `${baseName}_extracted.pdf`,
    pageCount: pagesToExtract.length,
  };
}

/**
 * Rotate pages in the PDF
 */
export async function rotatePages(
  file: File,
  pageRotations: { pageNumber: number; rotation: number }[],
  settings: PdfOrganizeSettings
): Promise<OrganizeResult> {
  const arrayBuffer = await file.arrayBuffer();
  const { PDFDocument, degrees } = await getPdfLib();
  
  const srcDoc = await PDFDocument.load(arrayBuffer);
  const pages = srcDoc.getPages();

  for (const { pageNumber, rotation } of pageRotations) {
    if (pageNumber > 0 && pageNumber <= pages.length) {
      const page = pages[pageNumber - 1];
      const currentRotation = page.getRotation().angle;
      page.setRotation(degrees(currentRotation + rotation));
    }
  }

  const pdfBytes = await srcDoc.save({ useObjectStreams: false });
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });

  const baseName = file.name.replace(/\.pdf$/i, '');
  return {
    blob,
    filename: `${baseName}_rotated.pdf`,
    pageCount: pages.length,
  };
}
