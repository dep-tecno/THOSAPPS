import * as Y from 'yjs';
import { updateText } from './model.mjs';
import { firebaseConfig } from './firebase-config.mjs';

let service;
async function connectFirebase() {
  if (!firebaseConfig?.apiKey || !firebaseConfig?.databaseURL) {
    throw new Error('Falta la configuració Firebase del projecte THOSPAD.');
  }
  service ??= (async () => {
    const base = 'https://www.gstatic.com/firebasejs/12.19.0/';
    const [appSdk, authSdk, db] = await Promise.all([
      import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-database.js')
    ]);
    const app = appSdk.initializeApp(firebaseConfig, 'thospad');
    const auth = authSdk.initializeAuth(app, { persistence: authSdk.inMemoryPersistence });
    db.forceLongPolling();
    const database = db.getDatabase(app);
    return { db, database, user: (await authSdk.signInAnonymously(auth)).user };
  })().catch(error => { service = undefined; throw error; });
  return service;
}

export async function padRoom(roomId, password, initial, { changed, connection, busy }) {
  const { db, database, user } = await connectFirebase();
  const path = 'thospad/rooms/' + roomId;
  const at = name => db.ref(database, path + '/' + name);
  const denied = error => /permission.denied/i.test(error.code ?? error.message);
  if (initial) {
    const access = { owner: user.uid, secret: password, created: db.serverTimestamp() };
    try {
      await db.set(at('access'), { ...access, expiring: true });
    } catch (error) {
      if (!denied(error)) throw error;
      await db.set(at('access'), access);
    }
  }
  try {
    await db.set(at('members/' + user.uid), password);
  } catch (error) {
    if (!initial && denied(error)) {
      throw new Error('Aquest enllaç ha caducat o és incorrecte. Demana un enllaç nou.');
    }
    throw error;
  }
  const doc = new Y.Doc();
  const meta = doc.getMap('pad');
  const cards = doc.getMap('cards');
  const remote = Symbol();
  const queued = [];
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


  let closed = false;
  let online = false;
  let failed = false;
  let count = 0;
  const presence = at('presence/' + user.uid);
  const roomRef = db.ref(database, path);
  const disconnect = db.onDisconnect(roomRef);
  const legacyDisconnect = db.onDisconnect(presence);
  let tracksDeparture = false;
  const departure = () => ({ ['presence/' + user.uid]: null, idleSince: db.serverTimestamp() });
  const listeners = [];
  const pending = [];
  let writing = false;
  let retryAfter = 0;
  const report = () => connection(count, failed || !online);
  const fail = () => { if (!closed) { failed = true; report(); } };

  function encode(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  }

  async function sendPending() {
    if (closed || !online || writing || !pending.length || Date.now() < retryAfter) return;
    writing = true;
    try {
      while (!closed && online && pending.length) {
        const entry = pending[0];
        try {
          await db.set(entry.ref, entry.data);
        } catch (error) {
          const existing = (await db.get(entry.ref)).val();
          if (existing?.author !== user.uid ||
              Object.values(existing.parts ?? {}).join('') !== entry.data.parts.join('')) throw error;
        }
        pending.shift();
        failed = false;
        if (!closed) report();
      }
    } catch { retryAfter = Date.now() + 5000; fail(); }
    finally { writing = false; }
  }

  function flush() {
    if (closed || busy() || !queued.length) return;
    try {
      Y.applyUpdate(doc, Y.mergeUpdates(queued.splice(0)), remote);
      const pad = { ...meta.toJSON(), posts: [...cards.entries()].map(([id, card]) => ({ ...card.toJSON(), id })) };
      if (pad.type && typeof pad.title === 'string') changed(pad);
    } catch { fail(); }
  }

  const updates = at('updates');
  doc.on('update', (bytes, origin) => {
    if (origin === remote) return;
    // Firebase accepts individual strings up to 10 MB. Combine fragments before applying Yjs.
    const payload = encode(bytes);
    const fragments = payload.match(/.{1,500000}/g);
    pending.push({ ref: db.push(updates), data: { author: user.uid, parts: fragments } });
    void sendPending();
  });
  if (initial) save(null, initial);
  listeners.push(db.onChildAdded(updates, snapshot => {
    const value = snapshot.val();
    if (value.author === user.uid) return;
    try {
      const bytes = Uint8Array.from(atob(Object.values(value.parts).join('')), char => char.charCodeAt(0));
      queued.push(bytes);
    } catch { fail(); }
  }, fail));
  listeners.push(db.onValue(at('presence'), snapshot => {
    count = Math.max(0, snapshot.size - (snapshot.hasChild(user.uid) ? 1 : 0));
    report();
  }, fail));
  listeners.push(db.onValue(db.ref(database, '.info/connected'), async snapshot => {
    online = snapshot.val() === true;
    report();
    if (!online || closed) return;
    try {
      tracksDeparture = false;
      try {
        await disconnect.update(departure());
        tracksDeparture = true;
      } catch (error) {
        if (!denied(error)) throw error;
        await legacyDisconnect.remove();
      }
      if (closed) return;
      await db.set(presence, true);
      void sendPending();
    } catch { fail(); }
  }));
  const timer = setInterval(() => { flush(); void sendPending(); }, 300);
  return { save, flush, async close() {
    if (pending.length) throw new Error('Encara hi ha canvis pendents d’enviar. Reconnecta’t abans de sortir de la sala.');
    closed = true;
    clearInterval(timer);
    for (const stop of listeners) stop();
    if (online) {
      const leave = tracksDeparture ? db.update(roomRef, departure()) : db.remove(presence);
      void leave.then(() => tracksDeparture ? disconnect.cancel() : legacyDisconnect.cancel()).catch(() => {});
    }
    doc.destroy();
  } };
}
