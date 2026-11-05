import {parsePages} from './core.mjs';
const rows = () => [...document.getElementById('intervals').children];
const batch = 6;
let doc = null, task = null, generation = 0, disabled = false, count = 0, each = false, failed = false;
const states = new WeakMap();
let queue = Promise.resolve();
export function refreshPreviewControls(value = disabled) {
  disabled = value;
  for (const row of rows()) {
    const state = states.get(row);
    if (!state?.previous) continue;
    state.previous.disabled = disabled || each || state.offset === 0;
    state.next.disabled = disabled || each || state.offset + batch >= state.pages.length;
  }
}
export function resetPreview() {
  generation++; doc = null; failed = false;
  if (task) void task.destroy().catch(()=>{});
  task = null;
  for (const row of rows()) {states.delete(row); row.querySelector('.interval-preview').replaceChildren();}
}
export function updateIntervals(total = count, perPage = each) {
  count = total; each = perPage;
  for (const row of rows()) {
    const container = row.querySelector('.interval-preview'); container.hidden = each;
    if (each) continue;
    const values = [...row.querySelectorAll('input')].map(input=>input.value);
    const signature = values.join('-'), old = states.get(row);
    if (old?.signature === signature && old.doc === doc && old.failed === failed) continue;
    const state = {signature, doc, failed, offset:0, pages:[], token:0}; states.set(row,state);
    container.replaceChildren();
    const hint = document.createElement('p'); hint.className = 'hint'; container.append(hint);
    try {
      if (values.some(value=>!value)) throw new Error('Completa l’interval per veure’n les pàgines.');
      state.pages = parsePages(signature,count);
    } catch (error) {hint.textContent = error.message; continue;}
    if (!doc) {hint.textContent = failed ? 'Previsualització no disponible. Pots separar igualment el PDF.' : 'Preparant les pàgines de l’interval…'; continue;}
    hint.textContent = `${state.pages.length} pàgines en aquest interval`;
    const grid = document.createElement('div'); grid.className = 'interval-pages'; state.grid = grid; container.append(grid);
    const nav = document.createElement('div'); nav.className = 'interval-navigation'; nav.hidden = state.pages.length <= batch;
    for (const [key,text,delta] of [['previous','← Anteriors',-batch],['next','Següents →',batch]]) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.textContent = text;
      button.onclick = () => {state.offset += delta; draw(row,state);}; state[key] = button; nav.append(button);
    }
    container.append(nav); draw(row,state);
  }
  refreshPreviewControls();
}
function draw(row,state) {
  const token = ++state.token, current = generation, source = doc;
  refreshPreviewControls();
  drawThumbnails(state.grid, source, state.pages.slice(state.offset,state.offset+batch),
    () => current === generation && states.get(row) === state && token === state.token && row.isConnected);
}
function drawThumbnails(grid, source, pages, valid) {
  grid.replaceChildren();
  for (const index of pages) {
    const card = document.createElement('figure'), canvas = document.createElement('canvas'), caption = document.createElement('figcaption');
    caption.textContent = `Pàgina ${index+1}`; canvas.setAttribute('role','img'); canvas.setAttribute('aria-label',caption.textContent);
    card.append(canvas,caption); grid.append(card);
    queue = queue.catch(()=>{}).then(async()=>{
      if (!valid()) return;
      try {
        const page = await source.getPage(index+1);
        if (!valid()) return;
        const natural = page.getViewport({scale:1}), viewport = page.getViewport({scale:Math.min(400/natural.width,560/natural.height)});
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
        await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise; page.cleanup();
      } catch {if (valid()) caption.textContent = `Pàgina ${index+1} · Vista no disponible`;}
    });
  }
}
export function documentPreview(file) {
  const details = document.createElement('details');
  details.className = 'merge-preview';
  const summary = document.createElement('summary');
  summary.textContent = 'Previsualitza les pàgines';
  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.setAttribute('role','status');
  const grid = document.createElement('div');
  grid.className = 'interval-pages';
  const nav = document.createElement('div');
  nav.className = 'interval-navigation';
  const previous = document.createElement('button'), next = document.createElement('button');
  for (const button of [previous,next]) {
    button.type = 'button';
    button.className = 'secondary';
  }
  previous.textContent = '← Anteriors';
  next.textContent = 'Següents →';
  nav.append(previous,next);
  details.append(summary,hint,grid,nav);
  let loading, source, offset = 0, revision = 0;
  function close() {
    revision++;
    source = null;
    grid.replaceChildren();
    nav.hidden = true;
    if (loading) void loading.destroy().catch(()=>{});
    loading = null;
  }
  function drawBatch() {
    const end = Math.min(offset+batch, source.numPages);
    const current = ++revision;
    hint.textContent = `Pàgines ${offset+1}–${end} de ${source.numPages}`;
    nav.hidden = source.numPages <= batch;
    previous.disabled = offset === 0;
    next.disabled = end === source.numPages;
    drawThumbnails(grid,source,Array.from({length:end-offset},(_,i)=>offset+i),
      ()=>current===revision && details.open && details.isConnected);
  }
  previous.onclick = () => {if (source && offset>0) {offset-=batch; drawBatch();}};
  next.onclick = () => {if (source && offset+batch<source.numPages) {offset+=batch; drawBatch();}};
  details.ontoggle = async () => {
    close();
    if (!details.open || !details.isConnected) return;
    const current = revision;
    hint.textContent = 'Preparant la previsualització…';
    try {
      const pdfjs = await import('./vendor/pdfjs/pdf.min.mjs');
      const data = new Uint8Array(await file.arrayBuffer());
      if (current !== revision) return;
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs',import.meta.url).href;
      loading = pdfjs.getDocument({data,isEvalSupported:false,useWasm:false});
      const loaded = await loading.promise;
      if (current !== revision) return;
      source = loaded;
      offset = 0;
      drawBatch();
    } catch {
      if (current === revision) {
        close();
        hint.textContent = 'Previsualització no disponible. Pots unir igualment el PDF.';
      }
    }
  };
  nav.hidden = true;
  details.open = true;
  return {details,close};
}
export async function loadPreview(file) {
  const current = generation;
  try {
    const pdfjs = await import('./vendor/pdfjs/pdf.min.mjs');
    if (current !== generation) return;
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs',import.meta.url).href;
    const data = new Uint8Array(await file.arrayBuffer());
    if (current !== generation) return;
    task = pdfjs.getDocument({data,isEvalSupported:false,useWasm:false});
    const loaded = await task.promise;
    if (current !== generation) return;
    doc = loaded; updateIntervals();
  } catch {if (current === generation) {failed = true; updateIntervals();}}
}
