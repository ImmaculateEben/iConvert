# iConvert

A free, privacy-first file converter that runs entirely in your browser. No files are ever uploaded to a server — all processing happens client-side.

## ✨ Features

- **Image to Image** — Convert between PNG, JPG, and WebP with quality and resize controls
- **Image to PDF** — Combine one or more images into a PDF document (A4, Letter, or auto-sized pages)
- **PDF to Image** — Extract PDF pages as PNG or JPG at 1×, 2×, or 3× scale
- **Drag & Drop** — Upload files by dragging them onto the page or clicking to browse
- **Bulk Conversion** — Process multiple files at once with a concurrency limit to keep the UI responsive
- **Download All as ZIP** — Get all converted files in a single ZIP archive
- **Compression Presets** — Quality slider and resize options to reduce file size

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | CSS Modules + CSS Variables |
| PDF Rendering | pdfjs-dist |
| PDF Generation | jsPDF |
| ZIP Creation | JSZip |
| Deployment | Vercel (static export) |

## 📁 Project Structure

```
├── app/
│   ├── globals.css          # Design system (colors, typography, spacing)
│   ├── layout.tsx           # Root layout with metadata
│   ├── page.tsx             # Main single-page application
│   └── page.module.css      # Component styles
├── lib/
│   ├── types.ts             # TypeScript types & constants
│   ├── fileHelpers.ts       # File utilities (size formatting, validation, download)
│   ├── imageConverter.ts    # Image → PNG / JPG / WebP pipeline
│   ├── imageToPdf.ts        # Image → PDF pipeline
│   ├── pdfConverter.ts      # PDF → Image pipeline (via PDF.js)
│   └── zipHelper.ts         # ZIP creation for bulk downloads
├── next.config.js           # Static export configuration
├── tsconfig.json
└── package.json
```

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

The application will be available at your Vercel deployment URL.

## 🚀 Live Demo

Visit the live demo at: **https://i-convert-ebon.vercel.app**

## 📦 Build & Deploy

```bash
# Build for production (static export)
npm run build
```

The output is written to the `out/` directory and can be deployed to any static host.

### Deploy on Vercel

1. Push this repository to GitHub
2. Import the project at [vercel.com/new](https://vercel.com/new)
3. Vercel detects Next.js automatically — just click **Deploy**

## 🔒 Privacy

All file processing happens in the browser using the Canvas API, PDF.js, and jsPDF. **No files are uploaded to any server.** Object URLs are revoked after use to prevent memory leaks.

## 📄 License

MIT

---

Developed by [Immaculate Designs](https://Immaculatedesigns.com.ng)
