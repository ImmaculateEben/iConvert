import { ImageToPdfSettings } from './types';

// Dynamic import for jspdf
let jsPDF: any = null;

async function getJsPDF() {
  if (!jsPDF) {
    const module = await import('jspdf');
    jsPDF = module.default || module;
  }
  return jsPDF;
}

interface ConversionResult {
  blob: Blob;
  filename: string;
  pageCount: number;
}

// Page size dimensions in mm
const PAGE_SIZES: Record<string, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  letter: { width: 215.9, height: 279.4 },
};

// Margin sizes in mm
const MARGIN_SIZES: Record<string, number> = {
  none: 0,
  small: 10,
  medium: 20,
  large: 30,
};

/**
 * Load image and get its dimensions
 */
function loadImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Convert image file to data URL
 */
function imageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });
}

/**
 * Calculate page dimensions based on settings
 */
function getPageDimensions(settings: ImageToPdfSettings, imageWidth: number, imageHeight: number): { width: number; height: number } {
  const { pageSize, orientation } = settings;
  
  if (pageSize === 'auto') {
    // Convert pixels to mm (assuming 96 DPI)
    const mmPerPx = 25.4 / 96;
    return {
      width: imageWidth * mmPerPx,
      height: imageHeight * mmPerPx,
    };
  }
  
  const size = PAGE_SIZES[pageSize];
  
  if (orientation === 'landscape') {
    return { width: size.height, height: size.width };
  }
  
  return { width: size.width, height: size.height };
}

/**
 * Calculate image position and size to fit within page with margins
 */
function calculateImageFit(
  pageWidth: number,
  pageHeight: number,
  imageWidth: number,
  imageHeight: number,
  margin: number
): { x: number; y: number; width: number; height: number } {
  const availableWidth = pageWidth - (margin * 2);
  const availableHeight = pageHeight - (margin * 2);
  
  const widthRatio = availableWidth / imageWidth;
  const heightRatio = availableHeight / imageHeight;
  const ratio = Math.min(widthRatio, heightRatio);
  
  const newWidth = imageWidth * ratio;
  const newHeight = imageHeight * ratio;
  
  const x = margin + (availableWidth - newWidth) / 2;
  const y = margin + (availableHeight - newHeight) / 2;
  
  return { x, y, width: newWidth, height: newHeight };
}

/**
 * Convert images to PDF
 */
export async function convertImagesToPdf(
  files: File[],
  settings: ImageToPdfSettings
): Promise<ConversionResult> {
  const { pageSize, orientation, margin, imagesPerPage } = settings;
  const marginMm = MARGIN_SIZES[margin];
  
  // Load jsPDF
  const PDF = await getJsPDF();
  
  // Load all images
  const images: { file: File; dataUrl: string; width: number; height: number }[] = [];
  
  for (const file of files) {
    const [dataUrl, dimensions] = await Promise.all([
      imageToDataUrl(file),
      loadImageDimensions(file),
    ]);
    
    images.push({
      file,
      dataUrl,
      width: dimensions.width,
      height: dimensions.height,
    });
  }
  
  if (images.length === 0) {
    throw new Error('No images to convert');
  }
  
  // Determine page dimensions based on first image
  const pageDimensions = getPageDimensions(settings, images[0].width, images[0].height);
  
  // Create PDF
  const pdf = new PDF({
    orientation,
    unit: 'mm',
    format: pageSize === 'auto' ? [pageDimensions.width, pageDimensions.height] : pageSize,
  });
  
  // Add images
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    
    // Add new page if needed (for multi-image per page, or each image on new page)
    if (imagesPerPage === 1 || i === 0) {
      if (i > 0) {
        pdf.addPage();
      }
    }
    
    // Get current page dimensions
    const [pageWidth, pageHeight] = [pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight()];
    
    // Calculate image fit
    const { x, y, width, height } = calculateImageFit(
      pageWidth,
      pageHeight,
      img.width,
      img.height,
      marginMm
    );
    
    // Add image to PDF
    pdf.addImage(img.dataUrl, 'JPEG', x, y, width, height);
  }
  
  // Generate output
  const blob = pdf.output('blob');
  const filename = files.length === 1
    ? `${files[0].name.replace(/\.[^/.]+$/, '')}.pdf`
    : `converted_images_${Date.now()}.pdf`;
  
  return {
    blob,
    filename,
    pageCount: pdf.getNumberOfPages(),
  };
}
