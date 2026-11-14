import { getDocument, GlobalWorkerOptions, PDFDataRangeTransport } from './vendor/pdfjs/pdf.min.mjs';
import { MAX_FRAME_BYTES } from './session.mjs';

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
  let source = canvas;
  while (true) {
    for (const type of ['image/webp', 'image/jpeg']) {
      const image = await encode(source, type, 0.83);
      if (image?.size && image.size <= MAX_FRAME_BYTES) return image;
    }
    if (Math.max(source.width, source.height) <= 256) throw new Error('No s’ha pogut comprimir la pàgina.');
    const smaller = document.createElement('canvas');
    smaller.width = Math.max(1, Math.floor(source.width * 0.75));
    smaller.height = Math.max(1, Math.floor(source.height * 0.75));
    smaller.getContext('2d').drawImage(source, 0, 0, smaller.width, smaller.height);
    source = smaller;
  }
}
