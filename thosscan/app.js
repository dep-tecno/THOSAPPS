// THOSsCAN — adaptador Scribe.js. El paquet ESM s'ha de distribuir localment.
// Vegeu docs/guide.md de scribeocr/scribe.js. No s'utilitzen CDNs.
const fileInput = document.querySelector('#file');
const convert = document.querySelector('#convert');
const download = document.querySelector('#download');
const drive = document.querySelector('#drive');
const status = document.querySelector('#status');
const filename = document.querySelector('#filename');
const drop = document.querySelector('#drop');
const lang = document.querySelector('#lang');
const format = document.querySelector('#format');
let scribe = null;
let output = null;
const supported = /\.(pdf|jpe?g|png)$/i;
function updateFile(file) {
  output = null;
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
  scribe.opt.progressHandler = msg => {
    if (msg.type === 'recognize') status.textContent = 'Reconeixement OCR en curs…';
  };
  convert.textContent = 'Convertir';
  updateFile(fileInput.files[0]);
} catch (error) {
  status.textContent = 'Motor OCR encara no instal·lat. Cal integrar els recursos locals de Scribe.js.';
  console.info('THOSsCAN: Scribe.js pendent d’empaquetar', error);
}
convert.addEventListener('click', async () => {
  const input = fileInput.files[0];
  if (!scribe || !input || !supported.test(input.name)) return;
  convert.disabled = true;
  download.hidden = true;
  drive.hidden = true;
  let doc;
  let fase = 'obertura del document';
  output = null;
  try {
    status.textContent = 'Obrint document…';
    doc = await scribe.openDocument([input]);
    fase = 'reconeixement OCR';
    status.textContent = 'Reconeixent el contingut…';
    await doc.recognize({ langs: [lang.value], modeAdv: 'lstm' });
    fase = 'exportació del document';
    status.textContent = 'Preparant el document editable…';
    const ext = format.value;
    const bytes = await doc.exportData(ext);
    output = {
      blob: new Blob([bytes], { type: ext === 'docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      name: input.name.replace(/\.[^.]+$/, '') + '.' + ext,
    };
    download.hidden = false;
    download.disabled = false;
    drive.hidden = false;
    status.textContent = 'Conversió completada. Descarrega el fitxer.';
  } catch (error) {
    output = null;
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
  } finally {
    if (doc) {
      try { await doc.close(); }
      catch (error) { console.warn('THOSsCAN — tancament del document', error); }
    }
    convert.disabled = false;
  }
});
