import { PdfMergeSettings, PdfSplitSettings } from './types';

// Dynamic import for pdf-lib
let pdfLib: any = null;

async function getPdfLib() {
  if (!pdfLib) {
    const module = await import('pdf-lib');
    pdfLib = module;
  }
  return pdfLib;
}

interface MergeResult {
  blob: Blob;
  filename: string;
}

interface SplitResult {
  blob: Blob;
  filename: string;
  pageNumber: number;
}

/**
 * Merge multiple PDFs into one
 */
export async function mergePdfs(
  files: File[],
  settings: PdfMergeSettings
): Promise<MergeResult> {
  const { PDFDocument } = await getPdfLib();
  
  // Create a new PDF document
  const mergedPdf = await PDFDocument.create();
  
  // Load and copy pages from each PDF
  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    pages.forEach((page: any) => mergedPdf.addPage(page));
  }
  
  // Save the merged PDF
  const pdfBytes = await mergedPdf.save({
    useObjectStreams: false,
  });
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  
  // Generate filename
  const filename = files.length === 1
    ? `${files[0].name.replace(/\.[^/.]+$/, '')}_merged.pdf`
    : `merged_${Date.now()}.pdf`;
  
  return {
    blob,
    filename,
  };
}

/**
 * Split a PDF into multiple pages
 */
export async function splitPdf(
  files: File[],
  settings: PdfSplitSettings
): Promise<SplitResult[]> {
  const { PDFDocument } = await getPdfLib();
  const results: SplitResult[] = [];
  
  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const totalPages = pdf.getPageCount();
    const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
    
    let pagesToSplit: number[] = [];
    
    switch (settings.splitMode) {
      case 'all':
        // Split all pages - each page becomes a separate PDF
        pagesToSplit = Array.from({ length: totalPages }, (_, i) => i);
        break;
      case 'range':
        // Parse custom range (e.g., "1-3,5,7-9")
        if (settings.customRange) {
          pagesToSplit = parsePageRange(settings.customRange, totalPages);
        } else {
          pagesToSplit = Array.from({ length: totalPages }, (_, i) => i);
        }
        break;
      case 'single':
        // Just get the first page
        pagesToSplit = [0];
        break;
    }
    
    // Create a separate PDF for each selected page
    for (const pageIndex of pagesToSplit) {
      const newPdf = await PDFDocument.create();
      const [copiedPage] = await newPdf.copyPages(pdf, [pageIndex]);
      newPdf.addPage(copiedPage);
      
      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      
      const paddedPage = (pageIndex + 1).toString().padStart(3, '0');
      const filename = `${fileNameWithoutExt}_page_${paddedPage}.pdf`;
      
      results.push({
        blob,
        filename,
        pageNumber: pageIndex + 1,
      });
    }
  }
  
  return results;
}

/**
 * Parse page range string into array of page indices
 */
function parsePageRange(rangeStr: string, totalPages: number): number[] {
  const pages: number[] = [];
  const parts = rangeStr.split(',');
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-').map(Number);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          if (i >= 1 && i <= totalPages) {
            pages.push(i - 1); // Convert to 0-based index
          }
        }
      }
    } else {
      const page = Number(trimmed);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        pages.push(page - 1); // Convert to 0-based index
      }
    }
  }
  
  return [...new Set(pages)].sort((a, b) => a - b);
}

/**
 * Get number of pages in a PDF
 */
export async function getPdfPageCount(file: File): Promise<number> {
  const { PDFDocument } = await getPdfLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  return pdf.getPageCount();
}
