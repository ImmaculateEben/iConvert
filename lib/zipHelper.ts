/**
 * Create a ZIP file from multiple blobs
 */
export async function createZip(
  files: { blob: Blob; filename: string }[],
  zipFilename: string = 'converted_files.zip'
): Promise<Blob> {
  // Dynamic import JSZip
  const JSZip = (await import('jszip')).default;
  
  const zip = new JSZip();
  
  // Add files to zip
  for (const file of files) {
    zip.file(file.filename, file.blob);
  }
  
  // Generate zip blob
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  
  return zipBlob;
}

/**
 * Download a file from blob
 */
export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
