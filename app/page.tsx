'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  ConverterType,
  FileItem,
  ResultItem,
  ImageToImageSettings,
  ImageToPdfSettings,
  PdfToImageSettings,
  defaultImageToImageSettings,
  defaultImageToPdfSettings,
  defaultPdfToImageSettings,
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
} from '@/lib/fileHelpers';
import { convertImage, convertImages } from '@/lib/imageConverter';
import { convertImagesToPdf } from '@/lib/imageToPdf';
import { convertPdfToImages } from '@/lib/pdfConverter';
import { createZip, downloadFile } from '@/lib/zipHelper';
import styles from './page.module.css';

// Converter type options
const CONVERTER_OPTIONS: { value: ConverterType; label: string; description: string }[] = [
  { value: 'image-to-image', label: 'Image to Image', description: 'Convert between PNG, JPG, WebP' },
  { value: 'image-to-pdf', label: 'Image to PDF', description: 'Convert images to PDF document' },
  { value: 'pdf-to-image', label: 'PDF to Image', description: 'Convert PDF pages to images' },
];

export default function Home() {
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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setIsConverting(false);
    }
  }, [files, converterType, imageToImageSettings, imageToPdfSettings, pdfToImageSettings]);
  
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
  
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
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
                    <img src={file.previewUrl} alt={file.file.name} />
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
                return (
                  <div key={result.id} className={styles.resultItem}>
                    <div className={styles.resultPreview}>
                      <img src={result.previewUrl} alt={result.outputFilename} />
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
        
        {/* Footer */}
        <footer className={styles.footer}>
          <p>All conversions happen in your browser. Your files are never uploaded to any server.</p>
          <p className={styles.developedBy}>
            Developed by <a href="https://Immaculatedesigns.com.ng" target="_blank" rel="noopener noreferrer">Immaculate Designs</a>
          </p>
        </footer>
      </div>
    </main>
  );
}
