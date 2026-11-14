import { openSession, randomCode } from './session.mjs';

const el = id => document.getElementById(id);
const status = message => { el('status').textContent = message; };
const warning = message => { el('error').textContent = message; };
const canvas = el('canvas');
const image = el('page-image');

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

function clearPage() {
  image.removeAttribute('src');
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  imageUrl = undefined;
  image.hidden = true;
  el('student-page').textContent = '';
  el('stage').hidden = true;
}

function showPage(blob, { page, total }) {
  clearTimeout(connectionTimer);
  warning('');
  clearPage();
  imageUrl = URL.createObjectURL(blob);
  image.src = imageUrl;
  image.alt = `Pàgina ${page} del PDF compartit`;
  el('student-page').textContent = `Pàgina ${page} de ${total}`;
  image.hidden = false;
  el('stage').hidden = false;
}

function showRoster(requests, count, max) {
  el('count').textContent = `${count} de ${max} alumnes admesos`;
  el('admission').hidden = requests.size === 0;
  const items = [...requests].map(([peerId, userId]) => {
    const item = document.createElement('li');
    item.className = 'row';
    const admit = document.createElement('button');
    admit.textContent = 'Admet';
    admit.disabled = count >= max;
    admit.onclick = () => session?.decide(peerId, true);
    const deny = document.createElement('button');
    deny.textContent = 'Rebutja';
    deny.onclick = () => session?.decide(peerId, false);
    item.append(userId.slice(0, 14), admit, deny);
    return item;
  });
  el('requests').replaceChildren(...items);
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
    el('host-collision').hidden = el('student-collision').hidden = true;
    session = await openSession(code, teacher, {
      status, warning, clearPage, page: showPage, roster: showRoster,
      collision: found => { el(teacher ? 'host-collision' : 'student-collision').hidden = !found; },
    });
    el('lobby').hidden = true;
    el('board').hidden = el('leave').hidden = false;
    el('teacher').hidden = !teacher;
    el('verify').hidden = teacher;
    el('session-code').textContent = code;
    el(teacher ? 'teacher-id' : 'student-id').textContent = session.fingerprint;
    if (teacher) {
      el('pdf').focus();
    } else {
      el('fingerprint').focus();
      connectionTimer = setTimeout(() => {
        warning('Si encara esperes, comprova el codi, l’identificador i que la xarxa permeti la connexió directa.');
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
    ? `Pàgina ${pageNumber} de ${documentProxy.numPages}`
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
  const currentSession = session;
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
      const blob = await pdfModule.compressPage(canvas);
      if (current !== generation) return;
      currentSession.publish(blob, number, proxy.numPages);
      status('');
    } finally {
      renderTask = undefined;
      page.cleanup();
    }
  }).catch(() => {
    if (current !== generation) return;
    status('');
    warning('No s’ha pogut preparar aquesta pàgina del PDF.');
  });
}

let pdfModule;
el('pdf').onchange = async () => {
  const file = el('pdf').files[0];
  if (!file || !session) return;
  el('pdf').value = '';
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
  const code = el('code').value;
  if (/^[0-9]{4}$/.test(code)) void enter(code, false);
};

el('verify').onsubmit = event => {
  event.preventDefault();
  const field = el('fingerprint');
  const fingerprint = field.value.trim();
  if (/^[0-9A-Za-z]{14}$/.test(fingerprint)) {
    warning('');
    session?.verify(fingerprint);
  } else {
    warning('Escriu els 14 caràcters de l’identificador tal com surten a la pissarra.');
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
  el('board').hidden = el('leave').hidden = true;
  el('lobby').hidden = false;
  el('host').disabled = el('join-button').disabled = false;
  el('pdf').value = el('fingerprint').value = '';
  showRoster(new Map(), 0, 30);
  updateNavigation();
  el(mode === 'teacher' ? 'host' : 'code').focus();
  mode = undefined;
};
