import { openSession, randomCode } from './session.mjs';
import { createPageView } from './page-view.mjs';
import { createInk } from './ink.mjs';

const el = id => document.getElementById(id);
const status = message => { el('status').textContent = message; };
const warning = message => { el('error').textContent = message; };
const canvas = el('canvas');
const image = el('page-image');
const pageInk = new Map();
let inkPage;
const ink = createInk(el, (strokes, preview) => {
  if (inkPage === undefined) return;
  pageInk.set(inkPage, strokes);
  if (latestPage?.[1] === inkPage) session?.updateInk(strokes, preview);
});
const view = createPageView(el, state => {
  currentView = state;
  if (latestPage) session?.updateView(state);
}, ink);

let session;
let mode;
let imageUrl;
let pdf;
let documentProxy;
let pageNumber = 1;
let renderTask;
let renderQueue = Promise.resolve();
let generation = 0;
let connectionTimer;
let currentCode;
let latestPage;
let currentView;

function clearPage() {
  view.clear();
  ink.clear();
  inkPage = undefined;
  image.removeAttribute('src');
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  imageUrl = undefined;
  image.hidden = true;
  el('student-page').textContent = '';
  el('student-page').hidden = true;
  el('stage').hidden = true;
}

function showPage(blob, { page, total, view: state }) {
  clearTimeout(connectionTimer);
  warning('');
  clearPage();
  imageUrl = URL.createObjectURL(blob);
  image.src = imageUrl;
  image.alt = `Pàgina ${page} del PDF compartit`;
  el('student-page').textContent = `${page} / ${total}`;
  el('student-page').hidden = false;
  image.hidden = false;
  el('stage').hidden = false;
  view.show(image, state);
}

function showCount(count) {
  el('count').textContent = count;
}

function connect(code, teacher) {
  el('host-collision').hidden = el('student-collision').hidden = true;
  return openSession(code, teacher, {
    status, warning, clearPage, page: showPage, count: showCount,
    view: state => view.follow(state),
    ink: (strokes, preview) => ink.show(strokes, preview),
    collision: found => {
      el(teacher ? 'host-collision' : 'student-collision').hidden = !found;
      if (found && !teacher) clearTimeout(connectionTimer);
    },
  });
}

function showCode(code) {
  currentCode = code;
  el('session-code').textContent = code.slice(0, 3) + ' ' + code.slice(3);
}

async function enter(code, teacher) {
  if (mode) return;
  mode = teacher ? 'teacher' : 'student';
  el('host').disabled = el('join-button').disabled = true;
  el('lobby-error').textContent = '';
  try {
    if (!isSecureContext || !globalThis.RTCPeerConnection || location.protocol === 'file:') {
      throw new Error('Obre THOSBOARD des d’HTTPS o localhost amb un navegador compatible amb WebRTC.');
    }
    status('');
    warning('');
    if (!teacher) status('Cercant la sessió del professor…');
    session = await connect(code, teacher);
    document.body.classList.add('presenting');
    el('lobby').hidden = true;
    el('board').hidden = el('leave').hidden = false;
    el('teacher').hidden = !teacher;
    showCode(code);
    if (teacher) {
      el('choose-pdf').focus();
    } else {
      connectionTimer = setTimeout(() => {
        warning('Si encara esperes, comprova el codi i que la xarxa permeti la connexió directa.');
      }, 20000);
    }
  } catch (error) {
    mode = undefined;
    el('host').disabled = el('join-button').disabled = false;
    el('lobby-error').textContent = error.message || 'No s’ha pogut obrir la sessió.';
  }
}

function updateNavigation() {
  el('previous').disabled = !documentProxy || pageNumber <= 1;
  el('next').disabled = !documentProxy || pageNumber >= documentProxy.numPages;
  el('teacher-page').textContent = documentProxy
    ? `${pageNumber} / ${documentProxy.numPages}`
    : 'Cap PDF obert';
}

function changePage(number, pdfModule) {
  if (!documentProxy || number < 1 || number > documentProxy.numPages) return;
  pageNumber = number;
  updateNavigation();
  renderTask?.cancel();
  const current = ++generation;
  const source = pdf;
  const proxy = documentProxy;
  status('Preparant la pàgina…');
  warning('');
  renderQueue = renderQueue.then(async () => {
    if (current !== generation) return;
    const page = await source.withReadErrors(proxy.getPage(number));
    if (current !== generation) return;
    try {
      renderTask = pdfModule.drawPage(page, canvas);
      await source.withReadErrors(renderTask.promise);
      if (current !== generation) return;
      canvas.hidden = el('stage').hidden = false;
      latestPage = undefined;
      currentView = { zoom: 1, rotation: 0, x: 0, y: 0 };
      inkPage = number;
      ink.show(pageInk.get(number));
      view.show(canvas);
      const blob = await pdfModule.compressPage(canvas);
      if (current !== generation) return;
      latestPage = [blob, number, proxy.numPages];
      session?.publish(...latestPage, currentView, pageInk.get(number));
      status('');
    } finally {
      renderTask = undefined;
      page.cleanup();
    }
  }).catch(error => {
    if (current !== generation) return;
    console.error('THOSBOARD · PDF', error);
    status('');
    warning('No s’ha pogut preparar aquesta pàgina del PDF.');
  });
}

let pdfModule;
el('choose-pdf').onclick = () => el('pdf').click();
el('pdf').onchange = async () => {
  const file = el('pdf').files[0];
  if (!file || !session) return;
  el('pdf').value = '';
  pageInk.clear();
  latestPage = undefined;
  session.clear();
  const current = ++generation;
  renderTask?.cancel();
  const previous = pdf;
  pdf = documentProxy = undefined;
  clearPage();
  canvas.hidden = true;
  updateNavigation();
  status('Obrint el PDF…');
  warning('');
  try {
    await previous?.close();
    pdfModule ??= await import('./pdf.mjs');
    if (current !== generation) return;
    pdf = pdfModule.openPdf(file);
    const loaded = await pdf.document;
    if (current !== generation) return;
    documentProxy = loaded;
    changePage(1, pdfModule);
  } catch (error) {
    if (current !== generation) return;
    status('');
    warning(error.name === 'PasswordException'
      ? 'Aquest PDF està protegit amb contrasenya. Obre’n una còpia desbloquejada.'
      : 'No s’ha pogut obrir el PDF. Comprova el fitxer i la memòria disponible.');
  }
};

el('previous').onclick = () => changePage(pageNumber - 1, pdfModule);
el('next').onclick = () => changePage(pageNumber + 1, pdfModule);
el('host').onclick = () => void enter(randomCode(), true);
el('join').onsubmit = event => {
  event.preventDefault();
  const code = el('code').value.replace(' ', '');
  if (/^[0-9]{6}$/.test(code)) void enter(code, false);
};

el('new-code').onclick = async () => {
  if (!session || mode !== 'teacher') return;
  const previous = session;
  const oldCode = currentCode;
  const button = el('new-code');
  button.disabled = el('leave').disabled = true;
  let code;
  do { code = randomCode(); } while (code === oldCode);
  try {
    const next = await connect(code, true);
    session = next;
    showCount(0);
    warning('');
    showCode(code);
    if (latestPage) next.publish(...latestPage, currentView, pageInk.get(latestPage[1]));
    await previous.close();
  } catch {
    warning('No s’ha pogut canviar el codi de sessió.');
  } finally {
    button.disabled = el('leave').disabled = false;
  }
};

el('leave').onclick = async () => {
  const current = session;
  if (!current) return;
  session = undefined;
  ++generation;
  clearTimeout(connectionTimer);
  renderTask?.cancel();
  const documentToClose = pdf;
  pdf = documentProxy = undefined;
  await Promise.allSettled([current.close(), documentToClose?.close(), renderQueue]);
  clearPage();
  canvas.hidden = true;
  canvas.width = canvas.height = 0;
  el('board').hidden = el('leave').hidden = el('teacher').hidden = true;
  el('lobby').hidden = false;
  el('host').disabled = el('join-button').disabled = false;
  el('pdf').value = '';
  showCount(0);
  updateNavigation();
  el(mode === 'teacher' ? 'host' : 'code').focus();
  latestPage = undefined;
  pageInk.clear();
  ink.select(undefined);
  document.body.classList.remove('presenting');
  mode = undefined;
};
