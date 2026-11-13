import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { joinRoom } from 'trystero';
import { addCard, updateText } from './model.mjs';

const $ = id => document.getElementById(id);
const view = $('cards');
const fields = new Map();
const remote = Symbol('remote');
const storagePrefix = 'thospad-mur-p2p:';
const id = () => crypto.randomUUID();
let doc, cards, persistence, session, project;
let ready = false;

function render() {
  for (const [key, entry] of fields) {
    if (!cards.has(key)) {
      entry.article.remove();
      fields.delete(key);
    }
  }
  for (const [key, card] of cards) {
    if (!(card instanceof Y.Map)) continue;
    if (!fields.has(key)) {
      const article = document.createElement('article');
      const controls = {};
      for (const [name, labelText, tag] of [['title', 'Títol', 'input'], ['body', 'Text', 'textarea']]) {
        const label = document.createElement('label');
        label.textContent = labelText;
        const input = document.createElement(tag);
        controls[name] = input;
        input.addEventListener('input', () => {
          const text = cards.get(key)?.get(name);
          if (text instanceof Y.Text) updateText(text, input.value);
        });
        label.append(input);
        article.append(label);
      }
      const remove = document.createElement('button');
      remove.textContent = 'Suprimeix';
      remove.addEventListener('click', () => cards.delete(key));
      article.append(remove);
      view.append(article);
      fields.set(key, { article, controls });
    }
    for (const [name, input] of Object.entries(fields.get(key).controls)) {
      const text = card.get(name);
      const value = text instanceof Y.Text ? text.toString() : '';
      if (input.value === value) continue;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      input.value = value;
      if (document.activeElement === input) input.setSelectionRange(start, end);
    }
  }
}

async function openProject(key) {
  ready = false;
  if (persistence) await persistence.destroy();
  doc?.destroy();
  project = key;
  doc = new Y.Doc();
  cards = doc.getMap('cards');
  view.replaceChildren();
  fields.clear();
  cards.observeDeep(render);
  persistence = new IndexeddbPersistence(storagePrefix + key, doc);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('No s’ha pogut obrir el desament local.')), 8000);
    persistence.whenSynced.then(() => { clearTimeout(timer); resolve(); }, reject);
  });
  render();
  ready = true;
}

function refresh() {
  const count = session?.peers.size ?? 0;
  $('connection').textContent = session
    ? count ? 'Connectat · ' + (count + 1) + ' navegadors' : 'Esperant altres participants…'
    : 'Sense compartir';
  $('invite').hidden = !session;
  $('leave').hidden = !session;
  $('share').hidden = Boolean(session);
  $('share').disabled = !ready;
  $('save').disabled = !ready;
  $('open').disabled = !ready || Boolean(session);
  $('add').disabled = !ready;
}

function startRoom(roomId, password) {
  const room = joinRoom({ appId: 'tecno-apps.cat/thospad/mur-p2p-v1', password }, roomId);
  const state = { room, peers: new Set() };
  session = state;
  const vectors = room.makeAction('state-vector');
  const updates = room.makeAction('update');
  const report = () => { if (session === state) $('feedback').textContent = 'Connexió interrompuda. Els canvis es desen en aquest navegador.'; };
  const send = (action, bytes, target) => action.send(bytes, target ? { target } : undefined).catch(report);
  const requestSync = peerId => send(vectors, Y.encodeStateVector(doc), peerId);
  const validBytes = data => data instanceof Uint8Array && data.byteLength <= 2_000_000;
  vectors.onMessage((data, { peerId }) => {
    if (session !== state || !validBytes(data)) return;
    try { void send(updates, Y.encodeStateAsUpdate(doc, data), peerId); } catch { report(); }
  });
  updates.onMessage(data => {
    if (session !== state || !validBytes(data)) return;
    try { Y.applyUpdate(doc, data, remote); } catch { report(); }
  });
  room.onPeerJoin(({ peerId }) => {
    state.peers.add(peerId);
    refresh();
    void requestSync(peerId);
  }, { replay: true });
  room.onPeerLeave(({ peerId }) => { state.peers.delete(peerId); refresh(); });
  room.onError(report);
  state.onUpdate = (update, origin) => {
    if (origin !== remote && state.peers.size) void send(updates, update);
  };
  doc.on('update', state.onUpdate);
  state.retry = setInterval(() => {
    for (const peerId of state.peers) void requestSync(peerId);
  }, 15000);
  const url = new URL(location.href);
  url.hash = new URLSearchParams({ sala: roomId, clau: password }).toString();
  $('link').value = url.href;
  refresh();
}

$('share').onclick = () => {
  try { startRoom(id(), id()); }
  catch { $('feedback').textContent = 'No s’ha pogut iniciar la sessió.'; }
};
$('leave').onclick = async () => {
  const state = session;
  session = undefined;
  clearInterval(state.retry);
  doc.off('update', state.onUpdate);
  history.replaceState(null, '', location.pathname + location.search);
  localStorage.setItem(storagePrefix + 'last', project);
  await state.room.leave();
  $('feedback').textContent = 'Has sortit de la sala. El mur queda desat en aquest navegador.';
  refresh();
};
$('copy').onclick = async () => {
  try {
    await navigator.clipboard.writeText($('link').value);
    $('feedback').textContent = 'Enllaç copiat.';
  } catch {
    $('link').select();
    $('feedback').textContent = 'Copia l’enllaç seleccionat.';
  }
};
$('add').onclick = () => {
  const key = id();
  addCard(cards, key);
  fields.get(key)?.controls.title.focus();
};
$('save').onclick = () => {
  const data = [...cards.values()].map(card => ({
    title: card.get('title').toString(), body: card.get('body').toString()
  }));
  const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'THOSPAD-MUR-P2P', version: 1, cards: data })], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'mur-compartit.thospad';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
};
$('open').onclick = () => $('file').click();
$('file').onchange = async () => {
  const file = $('file').files[0];
  $('file').value = '';
  if (!file || session || !ready) return;
  try {
    if (file.size > 2_000_000) throw new Error();
    const data = JSON.parse(await file.text());
    if (data?.format !== 'THOSPAD-MUR-P2P' || data.version !== 1 || !Array.isArray(data.cards) ||
      !data.cards.every(card => typeof card?.title === 'string' && typeof card.body === 'string')) throw new Error();
    if (session || !ready) return;
    const key = id();
    const opening = openProject(key);
    refresh();
    await opening;
    doc.transact(() => { for (const card of data.cards) addCard(cards, id(), card.title, card.body); });
    localStorage.setItem(storagePrefix + 'last', key);
    $('feedback').textContent = 'Mur obert.';
  } catch { $('feedback').textContent = 'No s’ha pogut obrir aquest fitxer de prova.'; }
  refresh();
};

async function init() {
  if (!isSecureContext || location.protocol === 'file:') throw new Error('Obre el prototip per HTTPS o localhost.');
  const params = new URLSearchParams(location.hash.slice(1));
  const roomId = params.get('sala');
  const password = params.get('clau');
  const valid = value => /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value ?? '');
  if ((roomId || password) && (!valid(roomId) || !valid(password))) throw new Error('L’enllaç de la sala és incorrecte.');
  const key = roomId ? 'sala-' + roomId : localStorage.getItem(storagePrefix + 'last') || id();
  await openProject(key);
  localStorage.setItem(storagePrefix + 'last', key);
  if (roomId) startRoom(roomId, password);
  refresh();
}

init().catch(error => { $('connection').textContent = error.message; });
