import { PdfOrganizeSettings } from './types';

// Static imports for pdfjs and pdf-lib
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, degrees } from 'pdf-lib';

// Initialize pdfjs worker
if (typeof window !== 'undefined') {
  const version = pdfjsLib.version || '3.11.174';
  try {
    (pdfjsLib as any).GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;
  } catch (e) {
    // Worker already set
  }
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

function buildPdfFilename(file: File, suffix: string): string {
  const baseName = file.name.replace(/\.pdf$/i, '');
  return `${baseName}_${suffix}.pdf`;
}

async function savePdfDocument(doc: PDFDocument): Promise<Blob> {
  const pdfBytes = await doc.save({ useObjectStreams: false });
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

async function createOrganizeResult(
  doc: PDFDocument,
  file: File,
  suffix: string,
  pageCount: number
): Promise<OrganizeResult> {
  return {
    blob: await savePdfDocument(doc),
    filename: buildPdfFilename(file, suffix),
    pageCount,
  };
}

/**
 * Load a PDF file and extract page thumbnails
 */
export async function loadPdfPages(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<PdfPage[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
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
    canvas.width = 0;
    canvas.height = 0;

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
  _settings: PdfOrganizeSettings
): Promise<OrganizeResult> {
  const arrayBuffer = await file.arrayBuffer();
  
  const srcDoc = await PDFDocument.load(arrayBuffer);
  const newDoc = await PDFDocument.create();

  // Reorder pages according to new order
  const copiedPages = await newDoc.copyPages(srcDoc, pages.map(p => p.originalPageNumber - 1));
  
  for (let i = 0; i < copiedPages.length; i++) {
    const page = copiedPages[i];
    newDoc.addPage(page);
    
    if (pages[i].rotation !== 0) {
      const currentRotation = page.getRotation().angle;
      const nextRotation = ((currentRotation + pages[i].rotation) % 360 + 360) % 360;
      page.setRotation(degrees(nextRotation));
    }
  }

  return createOrganizeResult(newDoc, file, 'organized', pages.length);
}

/**
 * Delete selected pages from PDF
 */
export async function deletePages(
  file: File,
  pagesToDelete: number[],
  _settings: PdfOrganizeSettings
): Promise<OrganizeResult> {
  const arrayBuffer = await file.arrayBuffer();
  
  const srcDoc = await PDFDocument.load(arrayBuffer);
  const numPages = srcDoc.getPageCount();
  
  const pagesToDeleteSet = new Set(pagesToDelete);
  const pagesToKeep: number[] = [];
  for (let i = 0; i < numPages; i++) {
    if (!pagesToDeleteSet.has(i + 1)) {
      pagesToKeep.push(i);
    }
  }

  const newDoc = await PDFDocument.create();
  const copiedPages = await newDoc.copyPages(srcDoc, pagesToKeep);
  
  for (const page of copiedPages) {
    newDoc.addPage(page);
  }

  return createOrganizeResult(newDoc, file, 'reduced', pagesToKeep.length);
}

/**
 * Extract selected pages as new PDF
 */
export async function extractPages(
  file: File,
  pagesToExtract: number[],
  _settings: PdfOrganizeSettings
): Promise<OrganizeResult> {
  const arrayBuffer = await file.arrayBuffer();
  
  const srcDoc = await PDFDocument.load(arrayBuffer);
  const newDoc = await PDFDocument.create();

  const pageIndices = [...new Set(pagesToExtract)]
    .map((pageNumber) => pageNumber - 1)
    .filter((pageIndex) => pageIndex >= 0 && pageIndex < srcDoc.getPageCount());
  const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);

  for (const page of copiedPages) {
    newDoc.addPage(page);
  }

  return createOrganizeResult(newDoc, file, 'extracted', copiedPages.length);
}

/**
 * Rotate pages in the PDF
 */
export async function rotatePages(
  file: File,
  pageRotations: { pageNumber: number; rotation: number }[],
  _settings: PdfOrganizeSettings
): Promise<OrganizeResult> {
  const arrayBuffer = await file.arrayBuffer();
  
  const srcDoc = await PDFDocument.load(arrayBuffer);
  const pages = srcDoc.getPages();

  for (const { pageNumber, rotation } of pageRotations) {
    if (pageNumber > 0 && pageNumber <= pages.length) {
      const page = pages[pageNumber - 1];
      const currentRotation = page.getRotation().angle;
      const nextRotation = ((currentRotation + rotation) % 360 + 360) % 360;
      page.setRotation(degrees(nextRotation));
    }
  }

  return createOrganizeResult(srcDoc, file, 'rotated', pages.length);
}
