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
  createPreviewUrl,
  revokePreviewUrl,
  isValidFileType,
  checkFileSize,
  downloadBlob,
} from '@/lib/fileHelpers';
import { convertImages } from '@/lib/imageConverter';
import { convertImagesToPdf } from '@/lib/imageToPdf';
import { convertPdfToImages } from '@/lib/pdfConverter';
import { mergePdfs, splitPdf } from '@/lib/pdfMergeSplit';
import { loadPdfPages, applyOrganizeChanges, PdfPage } from '@/lib/pdfOrganizer';
import { createZip, downloadFile } from '@/lib/zipHelper';
import styles from './page.module.css';

const CONVERTER_OPTIONS: { value: ConverterType; label: string; description: string; icon: JSX.Element }[] = [
  { 
    value: 'image-to-image', 
    label: 'Image to Image', 
    description: 'Convert between PNG, JPG, WebP, GIF',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )
  },
  { 
    value: 'image-to-pdf', 
    label: 'Image to PDF', 
    description: 'Convert images to PDF document',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </svg>
    )
  },
  { 
    value: 'pdf-to-image', 
    label: 'PDF to Image', 
    description: 'Convert PDF pages to images',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  },
  { 
    value: 'pdf-merge', 
    label: 'Merge PDF', 
    description: 'Combine multiple PDFs into one',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    )
  },
  { 
    value: 'pdf-split', 
    label: 'Split PDF', 
    description: 'Extract pages from PDF',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4-4m-4 4l4 4" />
      </svg>
    )
  },
  { 
    value: 'pdf-organize', 
    label: 'Organize PDF', 
    description: 'Reorder, rotate, delete pages',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    )
  },
];

export default function Home() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  useEffect(() => {
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

  const [converterType, setConverterType] = useState<ConverterType>('image-to-image');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  
  const [imageToImageSettings, setImageToImageSettings] = useState<ImageToImageSettings>(defaultImageToImageSettings);
  const [imageToPdfSettings, setImageToPdfSettings] = useState<ImageToPdfSettings>(defaultImageToPdfSettings);
  const [pdfToImageSettings, setPdfToImageSettings] = useState<PdfToImageSettings>(defaultPdfToImageSettings);
  const [pdfMergeSettings, setPdfMergeSettings] = useState<PdfMergeSettings>(defaultPdfMergeSettings);
  const [pdfSplitSettings, setPdfSplitSettings] = useState<PdfSplitSettings>(defaultPdfSplitSettings);
  const [pdfOrganizeSettings, setPdfOrganizeSettings] = useState<PdfOrganizeSettings>(defaultPdfOrganizeSettings);
  
  const [pdfPages, setPdfPages] = useState<PdfPage[]>([]);
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  
  const [history, setHistory] = useState<PdfPage[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const acceptedTypes = ACCEPTED_FILE_TYPES[converterType];
  
  const saveToHistory = useCallback((pages: PdfPage[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...pages]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);
  
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setPdfPages(prevState);
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex]);
  
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setPdfPages(nextState);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex]);
  
  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    
    const newFiles: FileItem[] = [];
    
    Array.from(selectedFiles).forEach((file) => {
      if (!isValidFileType(file, converterType)) {
        setError(`Invalid file type: ${file.name}. Accepted: ${acceptedTypes.join(', ')}`);
        return;
      }
      
      const sizeCheck = checkFileSize(file, converterType);
      if (!sizeCheck.valid) {
        setError(sizeCheck.message);
        return;
      }
      
      newFiles.push({
        id: generateId(),
        file,
        previewUrl: createPreviewUrl(file),
        status: 'pending',
      });
    });
    
    setFiles((prev) => [...prev, ...newFiles]);
    setError(null);
    
    if (converterType === 'pdf-organize' && newFiles.length > 0) {
      loadPdfPages(newFiles[0].file).then((pages) => {
        setPdfPages(pages);
        setHistory([[...pages]]);
        setHistoryIndex(0);
      });
    }
  }, [converterType, acceptedTypes]);
  
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);
  
  const handleRemoveFile = useCallback((id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file) {
        revokePreviewUrl(file.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);
  
  const handleClearFiles = useCallback(() => {
    files.forEach((f) => revokePreviewUrl(f.previewUrl));
    setFiles([]);
    setResults([]);
    setError(null);
    setPdfPages([]);
  }, [files]);
  
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
      
      setShowResults(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setIsConverting(false);
    }
  }, [files, converterType, imageToImageSettings, imageToPdfSettings, pdfToImageSettings, pdfMergeSettings, pdfSplitSettings, pdfOrganizeSettings, pdfPages]);
  
  const handleDownload = useCallback((result: ResultItem) => {
    downloadBlob(result.outputBlob, result.outputFilename);
  }, []);
  
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

  useEffect(() => {
    return () => {
      files.forEach((f) => revokePreviewUrl(f.previewUrl));
      results.forEach((r) => revokePreviewUrl(r.previewUrl));
    };
  }, []);

  const currentOption = CONVERTER_OPTIONS.find(opt => opt.value === converterType);

  return (
    <main className={styles.main}>
      <button
        className={styles.themeToggle}
        onClick={toggleTheme}
        aria-label="Toggle dark mode"
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </button>

      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.logoContainer}>
            <svg className={styles.logo} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#4f46e5" />
                </linearGradient>
              </defs>
              <path d="M16 12L32 4V28H16V12Z" fill="#a5b4fc" />
              <path d="M32 4L48 12V28H32V4Z" fill="url(#grad1)" />
              <path d="M16 28V44L32 52V28H16Z" fill="#6366f1" />
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

        {!showResults ? (
          <>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Select Conversion Type</h2>
              <div className={styles.converterOptions}>
                {CONVERTER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    className={`${styles.optionCard} ${converterType === option.value ? styles.optionCardActive : ''}`}
                    onClick={() => {
                      setConverterType(option.value);
                      handleClearFiles();
                    }}
                  >
                    <div className={styles.optionIcon}>{option.icon}</div>
                    <div className={styles.optionContent}>
                      <h3 className={styles.optionLabel}>{option.label}</h3>
                      <p className={styles.optionDescription}>{option.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Upload Files</h2>
              <div 
                className={styles.dropZone}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <input
                  type="file"
                  id="fileInput"
                  className={styles.fileInput}
                  onChange={(e) => handleFileSelect(e.target.files)}
                  accept={acceptedTypes.join(',')}
                  multiple={converterType !== 'pdf-to-image' && converterType !== 'pdf-split' && converterType !== 'pdf-organize'}
                />
                <label htmlFor="fileInput" className={styles.dropZoneLabel}>
                  <svg className={styles.uploadIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span>Drop files here or click to browse</span>
                  <span className={styles.fileTypes}>Accepted: {acceptedTypes.join(', ')}</span>
                </label>
              </div>

              {files.length > 0 && (
                <div className={styles.fileList}>
                  {files.map((file) => (
                    <div key={file.id} className={styles.fileItem}>
                      {file.previewUrl && file.file.type.startsWith('image/') ? (
                        <img src={file.previewUrl} alt={file.file.name} className={styles.filePreview} />
                      ) : (
                        <div className={styles.fileIcon}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      )}
                      <div className={styles.fileInfo}>
                        <span className={styles.fileName}>{file.file.name}</span>
                        <span className={styles.fileSize}>{(file.file.size / 1024).toFixed(1)} KB</span>
                      </div>
                      <button 
                        className={styles.removeButton}
                        onClick={() => handleRemoveFile(file.id)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {error && <div className={styles.error}>{error}</div>}
            </section>

            {files.length > 0 && (
              <button 
                className={styles.convertButton}
                onClick={handleConvert}
                disabled={isConverting}
              >
                {isConverting ? 'Converting...' : `Convert ${currentOption?.label}`}
              </button>
            )}
          </>
        ) : (
          <div className={styles.resultsSection}>
            <div className={styles.resultsHeader}>
              <h2 className={styles.sectionTitle}>Conversion Complete!</h2>
              <div className={styles.resultsActions}>
                {results.length > 1 && (
                  <button className={styles.downloadAllButton} onClick={handleDownloadAll}>
                    Download All (ZIP)
                  </button>
                )}
                <button 
                  className={styles.newConversionButton}
                  onClick={() => {
                    setShowResults(false);
                    setResults([]);
                    handleClearFiles();
                  }}
                >
                  New Conversion
                </button>
              </div>
            </div>

            <div className={styles.resultsList}>
              {results.map((result) => (
                <div key={result.id} className={styles.resultItem}>
                  {result.previewUrl && (result.originalFile.type.startsWith('image/') || result.originalFile.type === 'application/pdf') ? (
                    <img src={result.previewUrl} alt={result.outputFilename} className={styles.resultPreview} />
                  ) : (
                    <div className={styles.resultIcon}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  )}
                  <div className={styles.resultInfo}>
                    <span className={styles.resultName}>{result.outputFilename}</span>
                    <span className={styles.resultSize}>{(result.outputSize / 1024).toFixed(1)} KB</span>
                  </div>
                  <button 
                    className={styles.downloadButton}
                    onClick={() => handleDownload(result)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {isConverting && (
          <div className={styles.progressContainer}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progress}%` }}></div>
            </div>
            <span className={styles.progressText}>{progress}%</span>
          </div>
        )}
      </div>
    </main>
  );
}
