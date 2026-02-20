// Converter Types
export type ConverterType = 'image-to-image' | 'image-to-pdf' | 'pdf-to-image' | 'pdf-merge' | 'pdf-split';

// File Item
export interface FileItem {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  error?: string;
}

// Result Item
export interface ResultItem {
  id: string;
  originalFile: File;
  outputBlob: Blob;
  outputFilename: string;
  outputSize: number;
  previewUrl: string;
}

// Image to Image Settings
export interface ImageToImageSettings {
  outputFormat: 'png' | 'jpeg' | 'webp';
  quality: number;
  resizeMode: 'none' | 'scale' | 'max';
  resizeValue: number;
  preserveMetadata: boolean;
}

// Image to PDF Settings
export interface ImageToPdfSettings {
  pageSize: 'a4' | 'letter' | 'auto';
  orientation: 'portrait' | 'landscape';
  margin: 'none' | 'small' | 'medium' | 'large';
  imagesPerPage: number;
  quality: number;
  maxWidth: number;
}

// PDF to Image Settings
export interface PdfToImageSettings {
  outputFormat: 'png' | 'jpeg';
  quality: number;
  scale: number;
  pageRange: 'all' | 'custom';
  customPages?: string;
}

// PDF Merge Settings
export interface PdfMergeSettings {
  // No settings needed for merge, just combine all PDFs
}

// PDF Split Settings
export interface PdfSplitSettings {
  splitMode: 'all' | 'range' | 'single';
  customRange?: string;
}

// Union of all settings
export type ConversionSettings = ImageToImageSettings | ImageToPdfSettings | PdfToImageSettings | PdfMergeSettings | PdfSplitSettings;

// Default Settings
export const defaultImageToImageSettings: ImageToImageSettings = {
  outputFormat: 'png',
  quality: 0.9,
  resizeMode: 'none',
  resizeValue: 100,
  preserveMetadata: false,
};

export const defaultImageToPdfSettings: ImageToPdfSettings = {
  pageSize: 'a4',
  orientation: 'portrait',
  margin: 'medium',
  imagesPerPage: 1,
  quality: 0.8,
  maxWidth: 0,
};

export const defaultPdfToImageSettings: PdfToImageSettings = {
  outputFormat: 'png',
  quality: 0.9,
  scale: 2,
  pageRange: 'all',
};

export const defaultPdfMergeSettings: PdfMergeSettings = {};

export const defaultPdfSplitSettings: PdfSplitSettings = {
  splitMode: 'all',
  customRange: '',
};

// File type mappings
export const ACCEPTED_FILE_TYPES: Record<ConverterType, string[]> = {
  'image-to-image': ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  'image-to-pdf': ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  'pdf-to-image': ['application/pdf'],
  'pdf-merge': ['application/pdf'],
  'pdf-split': ['application/pdf'],
};

// File size limits (in bytes)
export const FILE_SIZE_LIMITS: Record<ConverterType, { recommended: number; max: number }> = {
  'image-to-image': { recommended: 10 * 1024 * 1024, max: 50 * 1024 * 1024 },
  'image-to-pdf': { recommended: 10 * 1024 * 1024, max: 50 * 1024 * 1024 },
  'pdf-to-image': { recommended: 10 * 1024 * 1024, max: 25 * 1024 * 1024 },
  'pdf-merge': { recommended: 10 * 1024 * 1024, max: 50 * 1024 * 1024 },
  'pdf-split': { recommended: 10 * 1024 * 1024, max: 50 * 1024 * 1024 },
};

// Conversion constants
export const CONCURRENCY_LIMIT = 2;

// MIME type to extension mapping
export const MIME_TO_EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};
