declare module 'pdfjs-dist' {
  export interface GlobalWorkerOptions {
    workerSrc: string;
  }
  
  export function getDocument(params: { data: ArrayBuffer | Uint8Array }): {
    promise: Promise<any>;
  };
  
  export const version: string;
}
