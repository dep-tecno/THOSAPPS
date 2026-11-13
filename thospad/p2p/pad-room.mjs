import * as Y from 'yjs';
import { joinRoom } from 'trystero';
import QRCode from 'qrcode';
import { updateText } from './model.mjs';

export function renderShareQr(canvas, link) {
  return QRCode.toCanvas(canvas, link, { margin: 4, scale: 8, errorCorrectionLevel: 'M' });
}

export function padRoom(roomId, password, initial, { changed, connection, busy }) {
  const doc = new Y.Doc();
  const meta = doc.getMap('pad');
  const cards = doc.getMap('cards');
  const remote = Symbol();
  const queued = [];
  const peers = new Set();
  const textFields = new Set(['title', 'body', 'description']);

  function write(map, previous, next) {
    for (const [key, value] of Object.entries(next)) {
      if (['id', 'posts'].includes(key) || JSON.stringify(previous[key]) === JSON.stringify(value)) continue;
      if (value === undefined) map.delete(key);
      else if (textFields.has(key) && typeof value === 'string') {
        if (map.get(key) instanceof Y.Text) updateText(map.get(key), value);
        else map.set(key, new Y.Text(value));
      } else map.set(key, value);
    }
  }

  function save(previous, next) {
    doc.transact(() => {
      write(meta, previous ?? {}, next);
      const old = new Map((previous?.posts ?? []).map(post => [post.id, post]));
      const current = new Set(next.posts.map(post => post.id));
      for (const id of old.keys()) if (!current.has(id)) cards.delete(id);
      for (const post of next.posts) {
        const prior = old.get(post.id);
        let card = cards.get(post.id);
        if (!card && prior) continue;
        if (!card) {
          card = new Y.Map();
          cards.set(post.id, card);
        }
        write(card, prior ?? {}, post);
      }
    });
  }

  if (initial) save(null, initial);
  const room = joinRoom({ appId: 'tecno-apps.cat/thospad/pad-v1', password }, roomId);
  const vectors = room.makeAction('vector');
  const updates = room.makeAction('update');
  const report = () => connection(peers.size, true);
  const send = (action, data, target) => {
    void action.send(data, target ? { target } : undefined).catch(report);
  };
  const sync = peer => send(vectors, Y.encodeStateVector(doc), peer);
  vectors.onMessage((bytes, { peerId }) => {
    if (!(bytes instanceof Uint8Array)) return;
    try { send(updates, Y.encodeStateAsUpdate(doc, bytes), peerId); } catch { report(); }
  });
  updates.onMessage(bytes => {
    if (!(bytes instanceof Uint8Array)) return;
    queued.push(bytes);
    flush();
  });
  function flush() {
    if (busy() || !queued.length) return;
    try {
      Y.applyUpdate(doc, Y.mergeUpdates(queued.splice(0)), remote);
      const pad = { ...meta.toJSON(), posts: [...cards.entries()].map(([id, card]) => ({ ...card.toJSON(), id })) };
      if (pad.type && typeof pad.title === 'string') changed(pad);
    } catch { report(); }
  }
  room.onPeerJoin(({ peerId }) => {
    peers.add(peerId);
    connection(peers.size);
    sync(peerId);
    if (meta.has('type')) send(updates, Y.encodeStateAsUpdate(doc), peerId);
  }, { replay: true });
  room.onPeerLeave(({ peerId }) => { peers.delete(peerId); connection(peers.size); });
  room.onError(report);
  doc.on('update', (bytes, origin) => { if (origin !== remote && peers.size) send(updates, bytes); });
  const timer = setInterval(() => { flush(); for (const peer of peers) sync(peer); }, 12000);
  return { save, flush, async close() { clearInterval(timer); await room.leave(); doc.destroy(); } };
}
