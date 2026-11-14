import { getDocument, GlobalWorkerOptions, PDFDataRangeTransport } from './vendor/pdfjs/pdf.min.mjs';
import { MAX_FRAME_BYTES } from './session.mjs';

const TARGET_FRAME_BYTES = 320 * 1024;

GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;

class LocalFileTransport extends PDFDataRangeTransport {
  constructor(file) {
    super(file.size, new Uint8Array(), true);
    this.file = file;
  }

  requestDataRange(begin, end) {
    this.file.slice(begin, end).arrayBuffer().then(buffer => {
      if (!this.aborted) this.onDataRange(begin, new Uint8Array(buffer));
    }).catch(error => {
      if (!this.aborted) this.onFailure(error);
    });
  }

  abort() {
    this.aborted = true;
  }
}

export function openPdf(file) {
  if (!file.size) throw new Error('El PDF està buit.');
  const range = new LocalFileTransport(file);
  const task = getDocument({
    range, disableStream: true, disableAutoFetch: true, isEvalSupported: false, useWasm: false,
  });
  const failure = new Promise((_, reject) => { range.onFailure = reject; });
  return {
    document: Promise.race([task.promise, failure]),
    withReadErrors: operation => Promise.race([operation, failure]),
    close: () => task.destroy(),
  };
}

export function drawPage(page, canvas) {
  const natural = page.getViewport({ scale: 1 });
  const scale = Math.min(2200 / Math.max(natural.width, natural.height),
    Math.sqrt(3000000 / (natural.width * natural.height)));
  const viewport = page.getViewport({ scale });
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const canvasContext = canvas.getContext('2d', { alpha: false });
  if (!canvasContext) throw new Error('El navegador no ha pogut obrir el llenç del PDF.');
  return page.render({ canvasContext, viewport, background: '#ffffff' });
}

function encode(canvas, type, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

export async function compressPage(canvas) {
  const preferred = await encode(canvas, 'image/webp', 0.83);
  if (preferred?.size && preferred.size <= TARGET_FRAME_BYTES) return preferred;

  // Preserve resolution for zoom while trying a smaller encoding.
  const type = preferred?.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
  const compact = await encode(canvas, type, 0.72);
  if (compact?.size && compact.size <= TARGET_FRAME_BYTES) return compact;

  const fallback = [preferred, compact]
    .filter(image => image?.size && image.size <= MAX_FRAME_BYTES)
    .sort((first, second) => first.size - second.size)[0];

  let source = canvas;
  while (Math.max(source.width, source.height) > (fallback ? 1600 : 256)) {
    const smaller = document.createElement('canvas');
    smaller.width = Math.max(1, Math.floor(source.width * 0.75));
    smaller.height = Math.max(1, Math.floor(source.height * 0.75));
    smaller.getContext('2d').drawImage(source, 0, 0, smaller.width, smaller.height);
    source = smaller;
    const image = await encode(source, type, 0.78);
    if (image?.size && image.size <= MAX_FRAME_BYTES && (!fallback || image.size < fallback.size)) return image;
  }
  if (fallback) return fallback;
  throw new Error('No s’ha pogut comprimir la pàgina.');
}
