'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  ConverterType,
  FileItem,
  ResultItem,
  ImageToImageSettings,
  ImageToPdfSettings,
  PdfToImageSettings,
  PdfMergeSettings,
  PdfSplitSettings,
  PdfOrganizeSettings,
  defaultImageToImageSettings,
  defaultImageToPdfSettings,
  defaultPdfToImageSettings,
  defaultPdfMergeSettings,
  defaultPdfSplitSettings,
  defaultPdfOrganizeSettings,
  ACCEPTED_FILE_TYPES,
  CONCURRENCY_LIMIT,
} from '@/lib/types';
import {
  generateId,
  formatFileSize,
  calculateSavings,
  createPreviewUrl,
  revokePreviewUrl,
  isValidFileType,
  checkFileSize,
  downloadBlob,
  isPdfFile,
} from '@/lib/fileHelpers';
import { convertImage, convertImages } from '@/lib/imageConverter';
import { convertImagesToPdf } from '@/lib/imageToPdf';
import { convertPdfToImages } from '@/lib/pdfConverter';
import { mergePdfs, splitPdf } from '@/lib/pdfMergeSplit';
import { loadPdfPages, applyOrganizeChanges, PdfPage } from '@/lib/pdfOrganizer';
import { createZip, downloadFile } from '@/lib/zipHelper';
import styles from './page.module.css';

// Feature data for landing page
const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Image Conversion',
    description: 'Convert between PNG, JPG, WebP, and GIF formats with customizable quality settings.'
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d=" " />
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </svg>
    ),
    title: 'PDF Tools',
    description: 'Convert images to PDF, PDF to images, merge multiple PDFs, or split PDFs by page range.'
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    title: 'Privacy First',
    description: 'All conversions happen locally in your browser. Your files never leave your device.'
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    title: 'Batch Processing',
    description: 'Convert multiple files at once with concurrent processing and ZIP download.'
  }
];

// How it works steps
const STEPS = [
  {
    number: '01',
    title: 'Choose Conversion Type',
    description: 'Select what you want to convert - images to different formats, images to PDF, or work with existing PDFs.'
  },
  {
    number: '02',
    title: 'Upload Your Files',
    description: 'Drag and drop files or click to browse. Supports bulk uploads for batch processing.'
  },
  {
    number: '03',
    title: 'Configure Settings',
    description: 'Adjust quality, output format, size, and other options to get exactly what you need.'
  },
  {
    number: '04',
    title: 'Download Results',
    description: 'Get your converted files instantly. Download individually or as a ZIP for multiple files.'
  }
];

// Converter type options
const CONVERTER_OPTIONS: { value: ConverterType; label: string; description: string }[] = [
  { value: 'image-to-image', label: 'Image to Image', description: 'Convert between PNG, JPG, WebP' },
  { value: 'image-to-pdf', label: 'Image to PDF', description: 'Convert images to PDF document' },
  { value: 'pdf-to-image', label: 'PDF to Image', description: 'Convert PDF pages to images' },
  { value: 'pdf-merge', label: 'Merge PDF', description: 'Combine multiple PDFs into one' },
  { value: 'pdf-split', label: 'Split PDF', description: 'Extract pages from PDF' },
  { value: 'pdf-organize', label: 'Organize PDF', description: 'Reorder, rotate, delete pages' },
];

export default function Home() {
  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [showConverter, setShowConverter] = useState(false);

  useEffect(() => {
    // Check for saved preference or system preference
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  }, [theme]);

  // State
  const [converterType, setConverterType] = useState<ConverterType>('image-to-image');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Settings state
  const [imageToImageSettings, setImageToImageSettings] = useState<ImageToImageSettings>(defaultImageToImageSettings);
  const [imageToPdfSettings, setImageToPdfSettings] = useState<ImageToPdfSettings>(defaultImageToPdfSettings);
  const [pdfToImageSettings, setPdfToImageSettings] = useState<PdfToImageSettings>(defaultPdfToImageSettings);
  const [pdfMergeSettings, setPdfMergeSettings] = useState<PdfMergeSettings>(defaultPdfMergeSettings);
  const [pdfSplitSettings, setPdfSplitSettings] = useState<PdfSplitSettings>(defaultPdfSplitSettings);
  const [pdfOrganizeSettings, setPdfOrganizeSettings] = useState<PdfOrganizeSettings>(defaultPdfOrganizeSettings);
  
  // PDF Pages state for organizer
  const [pdfPages, setPdfPages] = useState<PdfPage[]>([]);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  
  // Get accepted file types
  const acceptedTypes = ACCEPTED_FILE_TYPES[converterType];
  
  // Handle file selection
  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    
    const newFiles: FileItem[] = [];
    
    Array.from(selectedFiles).forEach((file) => {
      // Check file type
      if (!isValidFileType(file, converterType)) {
        setError(`Invalid file type: ${file.name}. Accepted: ${acceptedTypes.join(', ')}`);
        return;
      }
      
      // Check file size
      const sizeCheck = checkFileSize(file, converterType);
      if (!sizeCheck.valid) {
        setError(sizeCheck.message);
        return;
      }
      
      if (sizeCheck.message) {
        setError(sizeCheck.message);
      }
      
      // Create file item
      newFiles.push({
        id: generateId(),
        file,
        previewUrl: createPreviewUrl(file),
        status: 'pending',
      });
    });
    
    setFiles((prev) => [...prev, ...newFiles]);
    setError(null);
  }, [converterType, acceptedTypes]);
  
  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  
  // Remove file
  const handleRemoveFile = useCallback((id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file) {
        revokePreviewUrl(file.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);
  
  // Clear all files
  const handleClearFiles = useCallback(() => {
    files.forEach((f) => revokePreviewUrl(f.previewUrl));
    setFiles([]);
    setResults([]);
    setError(null);
  }, [files]);
  
  // Convert files
  const handleConvert = useCallback(async () => {
    if (files.length === 0) return;
    
    setIsConverting(true);
    setProgress(0);
    setResults([]);
    setError(null);
    
    try {
      switch (converterType) {
        case 'image-to-image': {
          const converted = await convertImages(
            files.map((f) => f.file),
            imageToImageSettings,
            CONCURRENCY_LIMIT,
            (completed, total) => setProgress(Math.round((completed / total) * 100))
          );
          
          const resultItems: ResultItem[] = converted.map((r, i) => ({
            id: generateId(),
            originalFile: files[i].file,
            outputBlob: r.blob,
            outputFilename: r.filename,
            outputSize: r.blob.size,
            previewUrl: createPreviewUrl(r.blob),
          }));
          
          setResults(resultItems);
          break;
        }
        
        case 'image-to-pdf': {
          const result = await convertImagesToPdf(
            files.map((f) => f.file),
            imageToPdfSettings
          );
          
          setResults([{
            id: generateId(),
            originalFile: files[0].file,
            outputBlob: result.blob,
            outputFilename: result.filename,
            outputSize: result.blob.size,
            previewUrl: createPreviewUrl(result.blob),
          }]);
          
          setProgress(100);
          break;
        }
        
        case 'pdf-to-image': {
          const pdfFile = files[0].file;
          const converted = await convertPdfToImages(
            pdfFile,
            pdfToImageSettings,
            (completed, total) => setProgress(Math.round((completed / total) * 100))
          );
          
          const resultItems: ResultItem[] = converted.map((r) => ({
            id: generateId(),
            originalFile: pdfFile,
            outputBlob: r.blob,
            outputFilename: r.filename,
            outputSize: r.blob.size,
            previewUrl: createPreviewUrl(r.blob),
          }));
          
          setResults(resultItems);
          break;
        }
        
        case 'pdf-merge': {
          const merged = await mergePdfs(
            files.map((f) => f.file),
            pdfMergeSettings
          );
          
          setResults([{
            id: generateId(),
            originalFile: files[0].file,
            outputBlob: merged.blob,
            outputFilename: merged.filename,
            outputSize: merged.blob.size,
            previewUrl: createPreviewUrl(merged.blob),
          }]);
          
          setProgress(100);
          break;
        }
        
        case 'pdf-split': {
          const pdfFile = files[0].file;
          const splitResults = await splitPdf(
            [pdfFile],
            pdfSplitSettings
          );
          
          const resultItems: ResultItem[] = splitResults.map((r) => ({
            id: generateId(),
            originalFile: pdfFile,
            outputBlob: r.blob,
            outputFilename: r.filename,
            outputSize: r.blob.size,
            previewUrl: createPreviewUrl(r.blob),
          }));
          
          setResults(resultItems);
          setProgress(100);
          break;
        }
        
        case 'pdf-organize': {
          const pdfFile = files[0].file;
          
          // Apply all changes from the organizer
          const result = await applyOrganizeChanges(
            pdfFile,
            pdfPages,
            pdfOrganizeSettings
          );
          
          setResults([{
            id: generateId(),
            originalFile: pdfFile,
            outputBlob: result.blob,
            outputFilename: result.filename,
            outputSize: result.blob.size,
            previewUrl: createPreviewUrl(result.blob),
          }]);
          
          setProgress(100);
          break;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setIsConverting(false);
    }
  }, [files, converterType, imageToImageSettings, imageToPdfSettings, pdfToImageSettings, pdfMergeSettings, pdfSplitSettings, pdfOrganizeSettings, pdfPages]);
  
  // Download single result
  const handleDownload = useCallback((result: ResultItem) => {
    downloadBlob(result.outputBlob, result.outputFilename);
  }, []);
  
  // Download all as ZIP
  const handleDownloadAll = useCallback(async () => {
    if (results.length === 0) return;
    
    try {
      const zipBlob = await createZip(
        results.map((r) => ({ blob: r.outputBlob, filename: r.outputFilename })),
        'converted_files.zip'
      );
      downloadFile(zipBlob, 'converted_files.zip');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ZIP');
    }
  }, [results]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      files.forEach((f) => revokePreviewUrl(f.previewUrl));
      results.forEach((r) => revokePreviewUrl(r.previewUrl));
    };
  }, []);
  
  // Total file size
  const totalSize = files.reduce((acc, f) => acc + f.file.size, 0);

  // If showing converter, render the converter interface
  if (showConverter) {
    return (
      <main className={styles.main}>
        {/* Theme Toggle */}
        <button
          className={styles.themeToggle}
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>

        {/* Back to Home Button */}
        <button
          className={styles.backButton}
          onClick={() => setShowConverter(false)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </button>

        <div className={styles.container}>
          {/* Header */}
          <header className={styles.header}>
            <div className={styles.logoContainer}>
              <svg className={styles.logo} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="fileGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#4f46e5" />
                  </linearGradient>
                  <linearGradient id="fileGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                  <linearGradient id="fileGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#a5b4fc" />
                    <stop offset="100%" stopColor="#818cf8" />
                  </linearGradient>
                </defs>
                <path d="M16 12L32 4V28H16V12Z" fill="url(#fileGrad3)" />
                <path d="M32 4L48 12V28H32V4Z" fill="url(#fileGrad2)" />
                <path d="M16 28V44L32 52V28H16Z" fill="url(#fileGrad1)" />
                <path d="M32 28V44L48 52V28H32Z" fill="#4f46e5" />
                <path d="M26 34L38 34L38 40L26 40L26 34Z" fill="#fbbf24" />
                <path d="M32 30L36 34H28L32 30Z" fill="#f59e0b" />
              </svg>
            </div>
            <h1 className={styles.title}>iConvert</h1>
            <p className={styles.subtitle}>
              Convert images and PDFs directly in your browser. No upload to server.
            </p>
          </header>
          
          {/* Converter Type Selector */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Select Conversion Type</h2>
            <div className={styles.converterOptions}>
              {CONVERTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`${styles.converterOption} ${converterType === option.value ? styles.converterOptionActive : ''}`}
                  onClick={() => {
                    setConverterType(option.value);
                    handleClearFiles();
                  }}
                >
                  <span className={styles.converterOptionLabel}>{option.label}</span>
                  <span className={styles.converterOptionDesc}>{option.description}</span>
                </button>
              ))}
            </div>
          </section>
          
          {/* Dropzone */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Upload Files</h2>
            <div
              className={styles.dropzone}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input
                id="file-input"
                type="file"
                multiple
                accept={acceptedTypes.join(',')}
                onChange={(e) => handleFileSelect(e.target.files)}
                className={styles.fileInput}
              />
              <div className={styles.dropzoneContent}>
                <svg className={styles.dropzoneIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className={styles.dropzoneText}>Drag and drop files here, or click to select</p>
                <p className={styles.dropzoneHint}>
                  {converterType === 'image-to-image' && 'Supports: PNG, JPG, WebP, GIF'}
                  {converterType === 'image-to-pdf' && 'Supports: PNG, JPG, WebP, GIF'}
                  {converterType === 'pdf-to-image' && 'Supports: PDF'}
                </p>
              </div>
            </div>
          </section>
          
          {/* Settings Panel */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Settings</h2>
            
            {converterType === 'image-to-image' && (
              <div className={styles.settingsPanel}>
                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>Output Format</label>
                  <select
                    className={styles.settingSelect}
                    value={imageToImageSettings.outputFormat}
                    onChange={(e) => setImageToImageSettings({ ...imageToImageSettings, outputFormat: e.target.value as 'png' | 'jpeg' | 'webp' })}
                  >
                    <option value="png">PNG</option>
                    <option value="jpeg">JPEG</option>
                    <option value="webp">WebP</option>
                  </select>
                </div>
                
                {(imageToImageSettings.outputFormat === 'jpeg' || imageToImageSettings.outputFormat === 'webp') && (
                  <div className={styles.settingRow}>
                    <label className={styles.settingLabel}>Quality: {Math.round(imageToImageSettings.quality * 100)}%</label>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={imageToImageSettings.quality * 100}
                      onChange={(e) => setImageToImageSettings({ ...imageToImageSettings, quality: Number(e.target.value) / 100 })}
                      className={styles.settingRange}
                    />
                  </div>
                )}
                
                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>Resize</label>
                  <select
                    className={styles.settingSelect}
                    value={imageToImageSettings.resizeMode}
                    onChange={(e) => setImageToImageSettings({ ...imageToImageSettings, resizeMode: e.target.value as 'none' | 'scale' | 'max' })}
                  >
                    <option value="none">Keep Original</option>
                    <option value="scale">Scale Percentage</option>
                    <option value="max">Max Width/Height</option>
                  </select>
                </div>
                
                {imageToImageSettings.resizeMode === 'scale' && (
                  <div className={styles.settingRow}>
                    <label className={styles.settingLabel}>Scale: {imageToImageSettings.resizeValue}%</label>
                    <input
                      type="range"
                      min="10"
                      max="200"
                      value={imageToImageSettings.resizeValue}
                      onChange={(e) => setImageToImageSettings({ ...imageToImageSettings, resizeValue: Number(e.target.value) })}
                      className={styles.settingRange}
                    />
                  </div>
                )}
                
                {imageToImageSettings.resizeMode === 'max' && (
                  <div className={styles.settingRow}>
                    <label className={styles.settingLabel}>Max Dimension: {imageToImageSettings.resizeValue}px</label>
                    <input
                      type="range"
                      min="100"
                      max="5000"
                      step="100"
                      value={imageToImageSettings.resizeValue}
                      onChange={(e) => setImageToImageSettings({ ...imageToImageSettings, resizeValue: Number(e.target.value) })}
                      className={styles.settingRange}
                    />
                  </div>
                )}
              </div>
            )}
            
            {converterType === 'image-to-pdf' && (
              <div className={styles.settingsPanel}>
                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>Page Size</label>
                  <select
                    className={styles.settingSelect}
                    value={imageToPdfSettings.pageSize}
                    onChange={(e) => setImageToPdfSettings({ ...imageToPdfSettings, pageSize: e.target.value as 'a4' | 'letter' | 'auto' })}
                  >
                    <option value="a4">A4</option>
                    <option value="letter">Letter</option>
                    <option value="auto">Auto (Image Size)</option>
                  </select>
                </div>
                
                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>Orientation</label>
                  <select
                    className={styles.settingSelect}
                    value={imageToPdfSettings.orientation}
                    onChange={(e) => setImageToPdfSettings({ ...imageToPdfSettings, orientation: e.target.value as 'portrait' | 'landscape' })}
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>
                
                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>Margin</label>
                  <select
                    className={styles.settingSelect}
                    value={imageToPdfSettings.margin}
                    onChange={(e) => setImageToPdfSettings({ ...imageToPdfSettings, margin: e.target.value as 'none' | 'small' | 'medium' | 'large' })}
                  >
                    <option value="none">None</option>
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
                
                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>Quality: {Math.round(imageToPdfSettings.quality * 100)}%</label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={imageToPdfSettings.quality * 100}
                    onChange={(e) => setImageToPdfSettings({ ...imageToPdfSettings, quality: Number(e.target.value) / 100 })}
                    className={styles.settingRange}
                  />
                </div>
                
                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>
                    Max Width: {imageToPdfSettings.maxWidth === 0 ? 'Original' : `${imageToPdfSettings.maxWidth}px`}
                  </label>
                  <select
                    className={styles.settingSelect}
                    value={imageToPdfSettings.maxWidth}
                    onChange={(e) => setImageToPdfSettings({ ...imageToPdfSettings, maxWidth: Number(e.target.value) })}
                  >
                    <option value={0}>Original</option>
                    <option value={800}>800px</option>
                    <option value={1024}>1024px</option>
                    <option value={1280}>1280px</option>
                    <option value={1600}>1600px</option>
                    <option value={1920}>1920px</option>
                  </select>
                </div>
              </div>
            )}
            
            {converterType === 'pdf-to-image' && (
              <div className={styles.settingsPanel}>
                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>Output Format</label>
                  <select
                    className={styles.settingSelect}
                    value={pdfToImageSettings.outputFormat}
                    onChange={(e) => setPdfToImageSettings({ ...pdfToImageSettings, outputFormat: e.target.value as 'png' | 'jpeg' })}
                  >
                    <option value="png">PNG</option>
                    <option value="jpeg">JPEG</option>
                  </select>
                </div>
                
                {pdfToImageSettings.outputFormat === 'jpeg' && (
                  <div className={styles.settingRow}>
                    <label className={styles.settingLabel}>Quality: {Math.round(pdfToImageSettings.quality * 100)}%</label>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={pdfToImageSettings.quality * 100}
                      onChange={(e) => setPdfToImageSettings({ ...pdfToImageSettings, quality: Number(e.target.value) / 100 })}
                      className={styles.settingRange}
                    />
                  </div>
                )}
                
                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>Scale</label>
                  <select
                    className={styles.settingSelect}
                    value={pdfToImageSettings.scale}
                    onChange={(e) => setPdfToImageSettings({ ...pdfToImageSettings, scale: Number(e.target.value) })}
                  >
                    <option value="1">1x (72 DPI)</option>
                    <option value="2">2x (144 DPI)</option>
                    <option value="3">3x (216 DPI)</option>
                  </select>
                </div>
              </div>
            )}
            
            {converterType === 'pdf-merge' && (
              <div className={styles.settingsPanel}>
                <p className={styles.settingHint}>
                  Select multiple PDF files to merge them into a single PDF. The files will be combined in the order they are listed.
                </p>
                
                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>Quality: {Math.round(pdfMergeSettings.quality * 100)}%</label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={pdfMergeSettings.quality * 100}
                    onChange={(e) => setPdfMergeSettings({ ...pdfMergeSettings, quality: Number(e.target.value) / 100 })}
                    className={styles.settingRange}
                  />
                </div>
              </div>
            )}
            
            {converterType === 'pdf-split' && (
              <div className={styles.settingsPanel}>
                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>Split Mode</label>
                  <select
                    className={styles.settingSelect}
                    value={pdfSplitSettings.splitMode}
                    onChange={(e) => setPdfSplitSettings({ ...pdfSplitSettings, splitMode: e.target.value as 'all' | 'range' | 'single' })}
                  >
                    <option value="all">All Pages (each page becomes a separate PDF)</option>
                    <option value="range">Custom Range</option>
                    <option value="single">First Page Only</option>
                  </select>
                </div>
                
                {pdfSplitSettings.splitMode === 'range' && (
                  <div className={styles.settingRow}>
                    <label className={styles.settingLabel}>Page Range</label>
                    <input
                      type="text"
                      className={styles.settingInput}
                      value={pdfSplitSettings.customRange || ''}
                      onChange={(e) => setPdfSplitSettings({ ...pdfSplitSettings, customRange: e.target.value })}
                      placeholder="e.g., 1-3, 5, 7-9"
                    />
                  </div>
                )}
                
                <div className={styles.settingRow}>
                  <label className={styles.settingLabel}>Quality: {Math.round(pdfSplitSettings.quality * 100)}%</label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={pdfSplitSettings.quality * 100}
                    onChange={(e) => setPdfSplitSettings({ ...pdfSplitSettings, quality: Number(e.target.value) / 100 })}
                    className={styles.settingRange}
                  />
                </div>
              </div>
            )}
            
            {converterType === 'pdf-organize' && (
              <div className={styles.settingsPanel}>
                <p className={styles.settingHint}>
                  Upload a PDF to view, reorder, rotate, and delete pages.
                </p>
                
                {/* Load PDF Pages Button */}
                {files.length > 0 && pdfPages.length === 0 && (
                  <button
                    className={styles.loadPagesButton}
                    onClick={async () => {
                      setIsLoadingPages(true);
                      try {
                        const pages = await loadPdfPages(files[0].file, (current, total) => {
                          setProgress(Math.round((current / total) * 100));
                        });
                        setPdfPages(pages);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to load PDF pages');
                      } finally {
                        setIsLoadingPages(false);
                      }
                    }}
                    disabled={isLoadingPages}
                  >
                    {isLoadingPages ? 'Loading pages...' : 'Load PDF Pages'}
                  </button>
                )}
                
                {/* PDF Pages Grid */}
                {pdfPages.length > 0 && (
                  <div className={styles.pdfPagesGrid}>
                    {pdfPages.map((page, index) => (
                      <div
                        key={page.pageNumber}
                        className={`${styles.pdfPageCard} ${selectedPages.includes(index + 1) ? styles.pdfPageCardSelected : ''}`}
                        onClick={() => {
                          setSelectedPages(prev => 
                            prev.includes(index + 1)
                              ? prev.filter(p => p !== index + 1)
                              : [...prev, index + 1]
                          );
                        }}
                      >
                        <div 
                          className={styles.pdfPageThumb}
                          style={{ transform: `rotate(${page.rotation}deg)` }}
                        >
                          {page.thumbnail && <img src={page.thumbnail} alt={`Page ${page.pageNumber}`} />}
                        </div>
                        <span className={styles.pdfPageNumber}>Page {page.pageNumber}</span>
                        <div className={styles.pdfPageActions}>
                          <button
                            className={styles.pageActionBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              const newPages = [...pdfPages];
                              newPages[index] = { ...page, rotation: (page.rotation + 90) % 360 };
                              setPdfPages(newPages);
                            }}
                            title="Rotate"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                          <button
                            className={styles.pageActionBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              const newPages = pdfPages.filter((_, i) => i !== index);
                              setPdfPages(newPages);
                            }}
                            title="Delete"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                        {selectedPages.includes(index + 1) && (
                          <span className={styles.selectedBadge}>Selected</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {pdfPages.length > 0 && (
                  <p className={styles.pageInfo}>
                    {pdfPages.length} page{pdfPages.length !== 1 ? 's' : ''} • {selectedPages.length} selected
                  </p>
                )}
              </div>
            )}
          </section>
          
          {/* Convert Button */}
          <div className={styles.convertButtonWrapper}>
            <button
              className={styles.convertButton}
              onClick={handleConvert}
              disabled={files.length === 0 || isConverting}
            >
              {isConverting ? (
                <>
                  <span className={styles.spinner}></span>
                  Converting... {progress}%
                </>
              ) : (
                `Convert ${files.length > 0 ? `(${files.length} file${files.length > 1 ? 's' : ''})` : ''}`
              )}
            </button>
          </div>
          
          {/* Error Message */}
          {error && (
            <div className={styles.error}>
              <span>{error}</span>
              <button onClick={() => setError(null)} className={styles.errorClose}>&times;</button>
            </div>
          )}
          
          {/* File List */}
          {files.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Files ({files.length})</h2>
                <span className={styles.fileSize}>{formatFileSize(totalSize)}</span>
                <button onClick={handleClearFiles} className={styles.clearButton}>Clear All</button>
              </div>
              <div className={styles.fileList}>
                {files.map((file) => (
                  <div key={file.id} className={styles.fileItem}>
                    <div className={styles.filePreview}>
                      {isPdfFile(file.file) ? (
                        <div className={styles.pdfIcon}>
                          <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
                            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M9,13V19H7V13H9M15,15V19H13V15H15M11,11V19H17V11H11Z" />
                          </svg>
                          <span className={styles.pdfLabel}>PDF</span>
                        </div>
                      ) : (
                        <img src={file.previewUrl} alt={file.file.name} />
                      )}
                    </div>
                    <div className={styles.fileInfo}>
                      <span className={styles.fileName}>{file.file.name}</span>
                      <span className={styles.fileMeta}>{formatFileSize(file.file.size)}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveFile(file.id)}
                      className={styles.removeButton}
                      aria-label="Remove file"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
          
          {/* Results */}
          {results.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Results ({results.length})</h2>
                {results.length > 1 && (
                  <button onClick={handleDownloadAll} className={styles.downloadAllButton}>
                    Download All (ZIP)
                  </button>
                )}
              </div>
              <div className={styles.resultList}>
                {results.map((result) => {
                  const savings = calculateSavings(result.originalFile.size, result.outputSize);
                  const isPdfResult = result.outputFilename.toLowerCase().endsWith('.pdf');
                  return (
                    <div key={result.id} className={styles.resultItem}>
                      <div className={styles.resultPreview}>
                        {isPdfResult ? (
                          <div className={styles.pdfIcon}>
                            <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
                              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M9,13V19H7V13H9M15,15V19H13V15H15M11,11V19H17V11H11Z" />
                            </svg>
                            <span className={styles.pdfLabel}>PDF</span>
                          </div>
                        ) : (
                          <img src={result.previewUrl} alt={result.outputFilename} />
                        )}
                      </div>
                      <div className={styles.resultInfo}>
                        <span className={styles.resultName}>{result.outputFilename}</span>
                        <span className={styles.resultMeta}>
                          {formatFileSize(result.outputSize)}
                          {savings > 0 && <span className={styles.savings}> (-{savings}%)</span>}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDownload(result)}
                        className={styles.downloadButton}
                      >
                        Download
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </main>
    );
  }

  // Landing page view
  return (
    <main className={styles.landingMain}>
      {/* Theme Toggle */}
      <button
        className={styles.themeToggle}
        onClick={toggleTheme}
        aria-label="Toggle dark mode"
        title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </button>

      {/* Navigation */}
      <nav className={styles.nav}>
        <div className={styles.navContainer}>
          <div className={styles.navLogo}>
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.navLogoIcon}>
              <defs>
                <linearGradient id="navFileGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#4f46e5" />
                </linearGradient>
                <linearGradient id="navFileGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#818cf8" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
                <linearGradient id="navFileGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#a5b4fc" />
                  <stop offset="100%" stopColor="#818cf8" />
                </linearGradient>
              </defs>
              <path d="M16 12L32 4V28H16V12Z" fill="url(#navFileGrad3)" />
              <path d="M32 4L48 12V28H32V4Z" fill="url(#navFileGrad2)" />
              <path d="M16 28V44L32 52V28H16Z" fill="url(#navFileGrad1)" />
              <path d="M32 28V44L48 52V28H32Z" fill="#4f46e5" />
              <path d="M26 34L38 34L38 40L26 40L26 34Z" fill="#fbbf24" />
              <path d="M32 30L36 34H28L32 30Z" fill="#f59e0b" />
            </svg>
            <span>iConvert</span>
          </div>
          <button 
            className={styles.navCta}
            onClick={() => setShowConverter(true)}
          >
            Start Converting
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroBackground}>
          <div className={styles.heroGlow}></div>
          <div className={styles.heroGrid}></div>
        </div>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            Convert Files <span className={styles.heroHighlight}>Instantly</span>
            <br />In Your Browser
          </h1>
          <p className={styles.heroSubtitle}>
            Transform images and PDFs with powerful conversion tools. 
            No uploads, no waiting, completely private. All processing happens locally on your device.
          </p>
          <div className={styles.heroCta}>
            <button 
              className={styles.heroButton}
              onClick={() => setShowConverter(true)}
            >
              <span>Get Started Free</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
            <span className={styles.heroNote}>No sign-up required</span>
          </div>
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <span className={styles.heroStatNumber}>5+</span>
              <span className={styles.heroStatLabel}>Conversion Tools</span>
            </div>
            <div className={styles.heroStatDivider}></div>
            <div className={styles.heroStat}>
              <span className={styles.heroStatNumber}>100%</span>
              <span className={styles.heroStatLabel}>Private & Secure</span>
            </div>
            <div className={styles.heroStatDivider}></div>
            <div className={styles.heroStat}>
              <span className={styles.heroStatNumber}>Free</span>
              <span className={styles.heroStatLabel}>No Hidden Costs</span>
            </div>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.heroCard}>
            <div className={styles.heroCardHeader}>
              <div className={styles.heroCardDot}></div>
              <div className={styles.heroCardDot}></div>
              <div className={styles.heroCardDot}></div>
            </div>
            <div className={styles.heroCardContent}>
              <div className={styles.heroCardIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </div>
              <div className={styles.heroCardText}>
                <span className={styles.heroCardTitle}>Image Converter</span>
                <span className={styles.heroCardDesc}>PNG → JPG → WebP</span>
              </div>
              <div className={styles.heroCardArrow}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </div>
            </div>
          </div>
          <div className={styles.heroCard}>
            <div className={styles.heroCardHeader}>
              <div className={styles.heroCardDot}></div>
              <div className={styles.heroCardDot}></div>
              <div className={styles.heroCardDot}></div>
            </div>
            <div className={styles.heroCardContent}>
              <div className={styles.heroCardIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div className={styles.heroCardText}>
                <span className={styles.heroCardTitle}>PDF Tools</span>
                <span className={styles.heroCardDesc}>Convert, Merge, Split</span>
              </div>
              <div className={styles.heroCardArrow}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={styles.features}>
        <div className={styles.featuresContainer}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionBadge}>Features</span>
            <h2 className={styles.sectionTitle}>Everything You Need</h2>
            <p className={styles.sectionSubtitle}>
              Powerful conversion tools that work entirely in your browser
            </p>
          </div>
          <div className={styles.featuresGrid}>
            {FEATURES.map((feature, index) => (
              <div key={index} className={styles.featureCard}>
                <div className={styles.featureIcon}>{feature.icon}</div>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDesc}>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className={styles.howItWorks}>
        <div className={styles.howItWorksContainer}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionBadge}>How It Works</span>
            <h2 className={styles.sectionTitle}>Convert in 4 Simple Steps</h2>
            <p className={styles.sectionSubtitle}>
              Get your files converted in seconds, no learning curve
            </p>
          </div>
          <div className={styles.stepsGrid}>
            {STEPS.map((step, index) => (
              <div key={index} className={styles.stepCard}>
                <span className={styles.stepNumber}>{step.number}</span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDesc}>{step.description}</p>
                {index < STEPS.length - 1 && (
                  <div className={styles.stepConnector}></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.cta}>
        <div className={styles.ctaContainer}>
          <div className={styles.ctaContent}>
            <h2 className={styles.ctaTitle}>Ready to Convert Your Files?</h2>
            <p className={styles.ctaSubtitle}>
              Start converting now - it's free, fast, and completely secure.
              All processing happens locally in your browser.
            </p>
            <button 
              className={styles.ctaButton}
              onClick={() => setShowConverter(true)}
            >
              Start Converting Now
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>
          <div className={styles.ctaDecor}>
            <div className={styles.ctaCircle}></div>
            <div className={styles.ctaCircle}></div>
            <div className={styles.ctaCircle}></div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContainer}>
          <div className={styles.footerMain}>
            <div className={styles.footerBrand}>
              <div className={styles.footerLogo}>
                <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="footerFileGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#4f46e5" />
                    </linearGradient>
                    <linearGradient id="footerFileGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                    <linearGradient id="footerFileGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#a5b4fc" />
                      <stop offset="100%" stopColor="#818cf8" />
                    </linearGradient>
                  </defs>
                  <path d="M16 12L32 4V28H16V12Z" fill="url(#footerFileGrad3)" />
                  <path d="M32 4L48 12V28H32V4Z" fill="url(#footerFileGrad2)" />
                  <path d="M16 28V44L32 52V28H16Z" fill="url(#footerFileGrad1)" />
                  <path d="M32 28V44L48 52V28H32Z" fill="#4f46e5" />
                  <path d="M26 34L38 34L38 40L26 40L26 34Z" fill="#fbbf24" />
                  <path d="M32 30L36 34H28L32 30Z" fill="#f59e0b" />
                </svg>
                <span>iConvert</span>
              </div>
              <p className={styles.footerDesc}>
                Fast, secure file conversion directly in your browser. 
                No uploads, no privacy concerns.
              </p>
            </div>
            <div className={styles.footerLinks}>
              <div className={styles.footerColumn}>
                <h4>Tools</h4>
                <a href="#" onClick={() => { setConverterType('image-to-image'); setShowConverter(true); }}>Image Converter</a>
                <a href="#" onClick={() => { setConverterType('image-to-pdf'); setShowConverter(true); }}>Image to PDF</a>
                <a href="#" onClick={() => { setConverterType('pdf-to-image'); setShowConverter(true); }}>PDF to Image</a>
                <a href="#" onClick={() => { setConverterType('pdf-merge'); setShowConverter(true); }}>Merge PDF</a>
                <a href="#" onClick={() => { setConverterType('pdf-split'); setShowConverter(true); }}>Split PDF</a>
              </div>
              <div className={styles.footerColumn}>
                <h4>Company</h4>
                <a href="https://immaculatedesigns.com.ng" target="_blank" rel="noopener noreferrer">About</a>
                <a href="https://immaculatedesigns.com.ng" target="_blank" rel="noopener noreferrer">Contact</a>
              </div>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <p>© {new Date().getFullYear()} iConvert. All rights reserved.</p>
            <p className={styles.footerPrivacy}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              All conversions happen locally. Your files never leave your device.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
