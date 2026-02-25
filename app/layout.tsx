import type { Metadata } from 'next';
import { IBM_Plex_Mono, Manrope, Space_Grotesk } from 'next/font/google';
import './globals.css';

const sansFont = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
});

const displayFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
});

const monoFont = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'iConvert - Convert Images & PDFs Online',
  description: 'Free online file converter. Convert images to PNG, JPG, WebP, PDF and convert PDFs to images. No upload to server - all processing happens in your browser.',
  keywords: 'iconvert, file converter, image converter, pdf converter, png, jpg, webp, pdf, online converter',
  authors: [{ name: 'iConvert' }],
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${sansFont.variable} ${displayFont.variable} ${monoFont.variable}`}>{children}</body>
    </html>
  );
}
