import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'File Converter - Convert Images & PDFs Online',
  description: 'Free online file converter. Convert images to PNG, JPG, WebP, PDF and convert PDFs to images. No upload to server - all processing happens in your browser.',
  keywords: 'file converter, image converter, pdf converter, png, jpg, webp, pdf, online converter',
  authors: [{ name: 'File Converter' }],
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
