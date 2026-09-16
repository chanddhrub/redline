/**
 * `pdfjs-dist` ships no types for its worker bundle, because it is normally
 * loaded by URL rather than imported. Here it is imported as a module and
 * handed to pdf.js directly (see `parse-document.ts`), so it needs a shape.
 *
 * Only the handler is named, and nothing calls it — pdf.js does, through
 * `globalThis.pdfjsWorker`.
 */
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown;
}
