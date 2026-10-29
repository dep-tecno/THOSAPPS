import {parsePages, copyDocuments, pdfName} from './core.mjs';
import {loadPreview, resetPreview, updateIntervals, refreshPreviewControls} from './preview.mjs';
const $ = id => document.getElementById(id);
let files = [], splitFile = null, busy = false, urls = [];
function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
function clearResults() { urls.forEach(url => URL.revokeObjectURL(url)); urls = []; $('downloads').replaceChildren(); $('results').hidden = true; }
function refresh() {
  $('files').replaceChildren();
  files.forEach((item, i) => {
    const li = document.createElement('li'), label = document.createElement('span'); label.className = 'file-name';
    label.textContent = `${i + 1}. ${item.file.name}`;
    const info = document.createElement('small'); info.textContent = `${item.doc.getPageCount()} pàgines · ${(item.file.size / 1048576).toFixed(2)} MB`; label.append(info); li.append(label);
    for (const [text, title, action, disabled] of [
      ['↑', 'Mou amunt', () => [files[i-1], files[i]] = [files[i], files[i-1]], i === 0],
      ['↓', 'Mou avall', () => [files[i+1], files[i]] = [files[i], files[i+1]], i === files.length-1],
      ['×', 'Elimina', () => files.splice(i, 1), false]]) {
      const button = document.createElement('button'); button.textContent = text; button.setAttribute('aria-label', `${title}: ${item.file.name}`); button.disabled = busy || disabled;
      button.onclick = () => {action(); clearResults(); refresh();}; li.append(button);
    }
    $('files').append(li);
  });
  $('summary').textContent = files.length ? `${files.length} documents · ${files.reduce((n, item) => n + item.doc.getPageCount(), 0)} pàgines` : 'Cap document afegit';
  $('merge').disabled = busy || files.length < 2; $('split').disabled = busy || !splitFile;
}
function lock(value) { busy = value; document.querySelectorAll('input,select,button').forEach(el => el.disabled = value); refresh(); $('interval-controls').disabled = value || $('split-mode').value === 'each'; refreshPreviewControls(value); }
function selectionChanged() {
  clearResults();
  if (!splitFile) return;
  updateIntervals(splitFile.doc.getPageCount(), $('split-mode').value === 'each');
}
function addInterval(start = '', end = '') {
  const row = document.createElement('div'); row.className = 'interval-row';
  for (const [text, value] of [['De la pàgina', start], ['Fins a la pàgina', end]]) {
    const label = document.createElement('label'); label.textContent = text;
    const input = document.createElement('input'); input.type = 'number'; input.min = '1'; input.step = '1'; input.value = value;
    if (splitFile) input.max = String(splitFile.doc.getPageCount());
    input.oninput = selectionChanged; label.append(input); row.append(label);
  }
  const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Elimina aquest interval');
  remove.onclick = () => {row.remove(); if (!$('intervals').children.length) addInterval(); selectionChanged();};
  const preview = document.createElement('div'); preview.className = 'interval-preview'; preview.setAttribute('aria-label','Pàgines d’aquest interval');
  row.append(remove, preview); $('intervals').append(row);
  return row;
}
function intervalValues(count) {
  return [...$('intervals').children].map((row, i) => {
    const [start,end] = [...row.querySelectorAll('input')].map(input => input.value);
    if (!start || !end) throw new Error(`Completa la pàgina inicial i final de l’interval ${i+1}.`);
    const text = `${start}-${end}`; return {text, pages:parsePages(text,count)};
  });
}
$('add-interval').onclick = () => { const row = addInterval(); row.querySelector('input').focus(); selectionChanged(); };
addInterval();
async function run(task) {
  if (busy) return;
  clearResults(); lock(true);
  try { if (!globalThis.PDFLib) throw new Error('No s’ha pogut carregar el motor PDF. Torna a obrir l’app.'); await task(); }
  catch (error) { clearResults(); status(error.message || 'No s’ha pogut completar l’operació.', true); }
  finally { lock(false); }
}
async function read(file) {
  if (!/\.pdf$/i.test(file.name)) throw new Error(`«${file.name}» no és un fitxer PDF.`);
  try {
    const doc = await PDFLib.PDFDocument.load(await file.arrayBuffer());
    if (!doc.getPageCount()) throw new Error('empty');
    return {file, doc};
  } catch { throw new Error(`No es pot llegir «${file.name}». Comprova que sigui un PDF vàlid i que no estigui protegit amb contrasenya.`); }
}
function result(bytes, name) {
  const url = URL.createObjectURL(new Blob([bytes], {type:'application/pdf'})); urls.push(url);
  const link = document.createElement('a'); link.href = url; link.download = pdfName(name); link.textContent = `↓ Descarrega ${link.download}`; $('downloads').append(link); $('results').hidden = false;
}
for (const mode of ['merge', 'split']) $(mode+'-tab').onclick = () => {
  for (const other of ['merge','split']) { $(other+'-tab').setAttribute('aria-pressed', String(mode === other)); $(other+'-panel').hidden = mode !== other; }
  clearResults(); status('');
};
$('merge-input').onchange = event => { const selected = [...event.target.files]; event.target.value = ''; run(async () => {
  const additions = []; for (const file of selected) { status(`Llegint ${file.name}…`); additions.push(await read(file)); }
  files.push(...additions); status('Documents afegits. Revisa’n l’ordre abans d’unir-los.');
}); };
$('split-input').onchange = event => { const file = event.target.files[0]; event.target.value = ''; if (!file) return; splitFile = null; resetPreview(); $('split-info').textContent = 'Cap document seleccionat'; run(async () => {
  status(`Llegint ${file.name}…`); splitFile = await read(file); $('split-info').textContent = `${file.name} · ${splitFile.doc.getPageCount()} pàgines`;
  $('intervals').replaceChildren(); addInterval(1, splitFile.doc.getPageCount()); $('split-name').value = file.name.replace(/\.pdf$/i, '')+'-extret.pdf'; status('Document preparat.');
  selectionChanged(); void loadPreview(file);
}); };
$('sort').onclick = () => { files.sort((a,b) => a.file.name.localeCompare(b.file.name, 'ca', {numeric:true})); clearResults(); refresh(); };
$('clear').onclick = () => { files = []; clearResults(); refresh(); status('Llista buida.'); };
$('split-mode').onchange = () => { $('interval-controls').disabled = $('split-mode').value === 'each'; selectionChanged(); };
$('merge').onclick = () => run(async () => {
  status('Unint els documents…'); result(await copyDocuments(PDFLib.PDFDocument, files), $('merge-name').value); status('PDF unificat. Ja el pots descarregar.');
});
$('split').onclick = () => run(async () => {
  const {doc} = splitFile;
  if ($('split-mode').value === 'each') {
    const base = pdfName($('split-name').value).replace(/\.pdf$/i, '');
    for (let i=0;i<doc.getPageCount();i++) {
      status(`Separant pàgina ${i+1} de ${doc.getPageCount()}…`);
      result(await copyDocuments(PDFLib.PDFDocument, [{doc,pages:[i]}]), `${base}-${String(i+1).padStart(3,'0')}.pdf`);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  } else {
    const intervals = intervalValues(doc.getPageCount());
    if ($('split-mode').value === 'interval') {
      const base = pdfName($('split-name').value).replace(/\.pdf$/i, '');
      for (let i=0; i<intervals.length; i++) {
        const {text,pages} = intervals[i];
        result(await copyDocuments(PDFLib.PDFDocument, [{doc,pages}]), `${base}-interval-${i+1}-pagines-${text}.pdf`);
      }
    } else result(await copyDocuments(PDFLib.PDFDocument, [{doc,pages:parsePages(intervals.map(item=>item.text).join(','), doc.getPageCount())}]), $('split-name').value);
  }
  status('Separació completada. Ja pots descarregar el resultat.');
});
window.addEventListener('pagehide', () => urls.forEach(url => URL.revokeObjectURL(url)));
refresh();
