import { ConverterType, ACCEPTED_FILE_TYPES, FILE_SIZE_LIMITS } from './types';

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Format file size to human readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Calculate size savings percentage
 */
export function calculateSavings(originalSize: number, newSize: number): number {
  if (originalSize === 0) return 0;
  return Math.round(((originalSize - newSize) / originalSize) * 100);
}

/**
 * Check if file type is accepted
 */
export function isValidFileType(file: File, converterType: ConverterType): boolean {
  const acceptedTypes = ACCEPTED_FILE_TYPES[converterType];
  return acceptedTypes.includes(file.type);
}

/**
 * Check if file exceeds recommended size
 */
export function checkFileSize(file: File, converterType: ConverterType): { valid: boolean; recommended: boolean; message: string } {
  const limits = FILE_SIZE_LIMITS[converterType];
  
  if (file.size > limits.max) {
    return {
      valid: false,
      recommended: false,
      message: `File exceeds maximum size of ${formatFileSize(limits.max)}`,
    };
  }
  
  if (file.size > limits.recommended) {
    return {
      valid: true,
      recommended: false,
      message: `File is larger than recommended (${formatFileSize(limits.recommended)}). Processing may be slow.`,
    };
  }
  
  return {
    valid: true,
    recommended: true,
    message: '',
  };
}

/**
 * Create object URL for file preview
 */
export function createPreviewUrl(file: File | Blob): string {
  return URL.createObjectURL(file);
}

/**
 * Revoke object URL to free memory
 */
export function revokePreviewUrl(url: string): void {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

/**
 * Get filename without extension
 */
export function getFileNameWithoutExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.substring(0, lastDot) : filename;
}

/**
 * Generate output filename
 */
export function generateOutputFilename(
  originalFilename: string,
  newExtension: string,
  suffix: string = '_converted'
): string {
  const name = getFileNameWithoutExtension(originalFilename);
  return `${name}${suffix}.${newExtension}`;
}

/**
 * Download blob as file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Read file as data URL (for image preview)
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Read file as ArrayBuffer (for PDF processing)
 */
export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
