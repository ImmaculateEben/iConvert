import { ImageToImageSettings } from './types';

interface ConversionResult {
  blob: Blob;
  filename: string;
  width: number;
  height: number;
}

/**
 * Load an image file into an ImageBitmap
 */
async function loadImage(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file);
}

/**
 * Calculate new dimensions based on resize settings
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  settings: ImageToImageSettings
): { width: number; height: number } {
  const { resizeMode, resizeValue } = settings;
  
  if (resizeMode === 'none') {
    return { width: originalWidth, height: originalHeight };
  }
  
  if (resizeMode === 'scale') {
    const scale = resizeValue / 100;
    return {
      width: Math.round(originalWidth * scale),
      height: Math.round(originalHeight * scale),
    };
  }
  
  // max mode
  const maxDim = resizeValue;
  if (originalWidth <= maxDim && originalHeight <= maxDim) {
    return { width: originalWidth, height: originalHeight };
  }
  
  const ratio = originalWidth / originalHeight;
  if (ratio > 1) {
    // Wider than tall
    return { width: maxDim, height: Math.round(maxDim / ratio) };
  } else {
    // Taller than wide
    return { width: Math.round(maxDim * ratio), height: maxDim };
  }
}

/**
 * Get MIME type from output format
 */
function getMimeType(format: 'png' | 'jpeg' | 'webp'): string {
  switch (format) {
    case 'png':
      return 'image/png';
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
  }
}

/**
 * Convert image to different format/quality
 */
export async function convertImage(
  file: File,
  settings: ImageToImageSettings
): Promise<ConversionResult> {
  const { outputFormat, quality, resizeMode, resizeValue } = settings;
  
  // Load the image
  const imageBitmap = await loadImage(file);
  
  // Calculate new dimensions
  const { width, height } = calculateDimensions(
    imageBitmap.width,
    imageBitmap.height,
    settings
  );
  
  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  
  // Handle transparency for JPEG (convert to white background)
  if (outputFormat === 'jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
  }
  
  // Draw the image
  ctx.drawImage(imageBitmap, 0, 0, width, height);
  
  // Get MIME type and quality
  const mimeType = getMimeType(outputFormat);
  const qualityValue = outputFormat === 'png' ? undefined : quality;
  
  // Convert to blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to convert image'));
      },
      mimeType,
      qualityValue
    );
  });
  
  // Generate output filename
  const originalName = file.name.replace(/\.[^/.]+$/, '');
  const extension = outputFormat === 'jpeg' ? 'jpg' : outputFormat;
  const filename = `${originalName}_converted.${extension}`;
  
  // Clean up
  imageBitmap.close();
  
  return {
    blob,
    filename,
    width,
    height,
  };
}

/**
 * Convert multiple images sequentially with concurrency limit
 */
export async function convertImages(
  files: File[],
  settings: ImageToImageSettings,
  concurrency: number = 2,
  onProgress?: (completed: number, total: number) => void
): Promise<ConversionResult[]> {
  const results: ConversionResult[] = [];
  let completed = 0;
  
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (file) => {
        try {
          const result = await convertImage(file, settings);
          completed++;
          onProgress?.(completed, files.length);
          return result;
        } catch (error) {
          throw new Error(`Failed to convert ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      })
    );
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Check if image has transparency
 */
export async function hasTransparency(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const pixelData = ctx.getImageData(0, 0, img.width, img.height);
        const data = pixelData.data;
        
        // Check for any pixel with alpha < 255
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] < 255) {
            resolve(true);
            return;
          }
        }
      }
      resolve(false);
    };
    img.onerror = () => resolve(false);
    img.src = URL.createObjectURL(file);
  });
}
