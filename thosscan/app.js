// THOSsCAN — adaptador Scribe.js. El paquet ESM s'ha de distribuir localment.
// Vegeu docs/guide.md de scribeocr/scribe.js. No s'utilitzen CDNs.
import { exportWord } from './word-export.js';
const fileInput = document.querySelector('#file');
const convert = document.querySelector('#convert');
const download = document.querySelector('#download');
const drive = document.querySelector('#drive');
const status = document.querySelector('#status');
const filename = document.querySelector('#filename');
const drop = document.querySelector('#drop');
const lang = document.querySelector('#lang');
const format = document.querySelector('#format');
const cancel = document.querySelector('#cancel');
const progress = document.querySelector('#progress');
let scribe = null;
let output = null;
let active = null;
const supported = /\.(pdf|jpe?g|png)$/i;
function showProgress(text, completed = null, total = null) {
  status.textContent = text;
  progress.hidden = false;
  if (Number.isFinite(total) && total > 0 && Number.isFinite(completed)) {
    progress.max = total;
    progress.value = Math.min(completed, total);
  } else progress.removeAttribute('value');
}
function lockControls(busy) {
  fileInput.disabled = busy;
  lang.disabled = busy;
  format.disabled = busy;
  convert.disabled = busy || !scribe || !supported.test(fileInput.files[0]?.name || '');
  cancel.hidden = !busy;
  cancel.disabled = false;
  drop.setAttribute('aria-disabled', String(busy));
}
function engineProgress(run, msg) {
  if (!run || !msg || active !== run || run.controller.signal.aborted) return;
  if (!Number.isInteger(msg.n) || msg.n < 0 || msg.n >= run.total) return;
  if (run.phase === 'ocr' && msg.type === 'convert') {
    // LSTM's convert event means this page has completed OCR and conversion.
    // Auto mode may skip native PDF pages: do not claim they were OCRed or
    // invent a percentage against a total the engine has not provided.
    run.ocrPages.add(msg.n);
    showProgress(`Reconeixement OCR · pàgina ${msg.n + 1} de ${run.total} · completades: ${run.ocrPages.size}.`);
  } else if (run.phase === 'export' && msg.type === 'export') {
    run.exportPages.add(msg.n);
    showProgress(`Preparant Excel · pàgines: ${run.exportPages.size} de ${run.total}.`, run.exportPages.size, run.total);
  }
}
cancel.addEventListener('click', () => {
  if (!active || active.controller.signal.aborted) return;
  active.controller.abort();
  cancel.disabled = true;
  showProgress('Cancel·lant… s’aturarà en acabar l’operació en curs.');
});
function updateFile(file) {
  if (active) return;
  output = null;
  progress.hidden = true;
  download.hidden = true;
  drive.hidden = true;
  if (!file) { convert.disabled = true; filename.textContent = 'Cap fitxer seleccionat'; return; }
  filename.textContent = `${file.name} · ${(file.size / 1048576).toFixed(2)} MB`;
  convert.disabled = !scribe || !supported.test(file.name);
  status.textContent = !supported.test(file.name) ? 'Format no admès.' :
    scribe ? 'Preparat per convertir.' : 'Motor OCR pendent d’instal·lar.';
}
fileInput.addEventListener('change', () => updateFile(fileInput.files[0]));
drop.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('drag'); });
drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
drop.addEventListener('drop', event => {
  event.preventDefault();
  drop.classList.remove('drag');
  if (active) return;
  const files = event.dataTransfer.files;
  if (files.length) {
    try { fileInput.files = files; updateFile(fileInput.files[0]); }
    catch { status.textContent = 'Selecciona el fitxer amb el botó de càrrega.'; }
  }
});
drive.addEventListener('click', () => window.open('https://drive.google.com/drive/u/0/my-drive', '_blank', 'noopener,noreferrer'));
download.addEventListener('click', () => {
  if (!output) return;
  const url = URL.createObjectURL(output.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = output.name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
});
try {
  // Cal empaquetar scribe.js-ocr al mateix origen, inclosos workers i models.
  const module = await import('scribe.js-ocr');
  scribe = module.default;
  scribe.opt.workerN = 2;
  scribe.opt.langPath = new URL('./models/', document.baseURI).href;
  scribe.opt.progressHandler = msg => engineProgress(active, msg);
  convert.textContent = 'Convertir';
  updateFile(fileInput.files[0]);
} catch (error) {
  status.textContent = 'Motor OCR encara no instal·lat. Cal integrar els recursos locals de Scribe.js.';
  console.info('THOSsCAN: Scribe.js pendent d’empaquetar', error);
}
convert.addEventListener('click', async () => {
  const input = fileInput.files[0];
  if (active || !scribe || !input || !supported.test(input.name)) return;
  const run = { controller: new AbortController(), phase: 'open', total: 0,
    ocrPages: new Set(), exportPages: new Set() };
  active = run;
  lockControls(true);
  download.hidden = true;
  drive.hidden = true;
  let doc;
  let candidate = null;
  let failure = null;
  let failed = false;
  let fase = 'obertura del document';
  output = null;
  try {
    showProgress('Obrint document…');
    doc = await scribe.openDocument([input]);
    run.controller.signal.throwIfAborted();
    run.total = doc.inputData.pageCount;
    doc.progressHandler = msg => engineProgress(run, msg);
    run.phase = 'ocr';
    fase = 'reconeixement OCR';
    showProgress(`Analitzant el contingut · ${run.total} pàgines.`);
    // Conservar el text nadiu dels PDF; aplicar OCR només on calgui.
    await doc.recognize({ langs: [lang.value], modeAdv: 'lstm', ocrPages: 'auto', signal: run.controller.signal });
    run.controller.signal.throwIfAborted();
    run.phase = 'export';
    fase = 'exportació del document';
    showProgress('Preparant el document editable…');
    const ext = format.value;
    const bytes = ext === 'docx' ? await exportWord(doc, scribe, {
      signal: run.controller.signal,
      onProgress: ({ stage, completed, total }) => {
        if (active !== run || run.controller.signal.aborted) return;
        const label = stage === 'images' ? 'Recuperant imatges' : 'Preparant Word';
        if (stage === 'packaging') showProgress('Empaquetant el document Word…');
        else showProgress(`${label} · pàgines: ${completed} de ${total}.`, completed, total);
      },
    }) : await doc.exportData(ext);
    run.controller.signal.throwIfAborted();
    candidate = {
      blob: new Blob([bytes], { type: ext === 'docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      name: input.name.replace(/\.[^.]+$/, '') + '.' + ext,
    };
  } catch (error) {
    failed = true;
    failure = error;
  } finally {
    run.phase = 'closing';
    if (doc) {
      try { await doc.close(); }
      catch (error) { console.warn('THOSsCAN — tancament del document', error); }
    }
    active = null;
    lockControls(false);
  }
  if (run.controller.signal.aborted || failure?.name === 'AbortError') {
    output = null;
    progress.hidden = true;
    status.textContent = 'Conversió cancel·lada. Pots tornar-ho a provar o seleccionar un altre document.';
  } else if (failed) {
    output = null;
    progress.hidden = true;
    const error = failure;
    const cause = error?.error ?? error?.reason ?? error;
    let detall = cause?.message || error?.message;
    if (!detall) {
      if (typeof cause === 'string') detall = cause;
      else {
        try { detall = JSON.stringify(cause); } catch { /* Pot contenir referències circulars. */ }
        if (!detall || detall === '{}') detall = String(cause);
      }
    }
    status.textContent = `Error durant ${fase}: ${detall || 'Error sense informació'}`;
    console.error(`THOSsCAN — ${fase}`, error);
  } else {
    output = candidate;
    download.hidden = false;
    download.disabled = false;
    drive.hidden = false;
    showProgress('Conversió completada. Descarrega el fitxer.', 1, 1);
  }
});


