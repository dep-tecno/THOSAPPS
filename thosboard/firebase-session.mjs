import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { initializeAuth, inMemoryPersistence, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { forceLongPolling, getDatabase, onDisconnect, onValue, ref, remove, runTransaction, set, update } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js';
import { firebaseConfig } from './firebase-config.mjs';

const app = initializeApp(firebaseConfig, 'thosboard');
const auth = initializeAuth(app, { persistence: inMemoryPersistence });
forceLongPolling();
const database = getDatabase(app);

function encode(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function openFirebaseSession(code, teacher, events) {
  if (!/^[0-9]{6}$/.test(code)) throw new Error('El codi de sessió ha de tenir sis xifres.');
  let user;
  try {
    user = auth.currentUser ?? (await signInAnonymously(auth)).user;
  } catch (error) {
    if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/admin-restricted-operation') {
      throw new Error('Cal activar l’accés anònim a Firebase Authentication per provar aquest mode.');
    }
    throw error;
  }
  const path = 'thosboard/rooms/' + code;
  const room = ref(database, path);
  const owner = ref(database, path + '/owner');
  const student = ref(database, path + '/students/' + user.uid);
  const connected = ref(database, '.info/connected');
  const disconnect = onDisconnect(teacher ? room : student);
  const listeners = [];
  let closed = false;
  let revision = 0;
  let shown;
  let state;
  let pending = {};
  let frameState;
  let timer;
  let writes = Promise.resolve();

  async function request(target, method, data, signal) {
    const token = await user.getIdToken();
    const url = new URL(target + '.json', firebaseConfig.databaseURL);
    url.searchParams.set('auth', token);
    if (method === 'PATCH') url.searchParams.set('print', 'silent');
    const response = await fetch(url, {
      method,
      cache: 'no-store',
      headers: data === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data),
      signal,
    });
    if (!response.ok) throw new Error('Firebase ha respost amb HTTP ' + response.status + '.');
    if (method === 'GET') return response.json();
  }

  function failed(error) {
    if (closed) return;
    console.error('THOSBOARD · Firebase', error);
    events.warning('No s’ha pogut sincronitzar la sessió amb Firebase. Comprova la connexió.');
  }

  function watch(target, callback) {
    listeners.push(onValue(target, snapshot => {
      if (!closed) callback(snapshot.val());
    }, failed));
  }

  function enqueue(work) {
    writes = writes.then(() => closed ? undefined : work()).catch(failed);
    return writes;
  }

  let pageDownload;
  if (teacher) {
    const result = await runTransaction(room, existing => {
      if (existing && existing.expiresAt > Date.now()) return;
      return { owner: user.uid, expiresAt: Date.now() + 3 * 60 * 60 * 1000 };
    }, { applyLocally: false });
    if (!result.committed) throw new Error('Aquest codi ja està en ús. Crea una sessió amb un altre codi.');
    try {
      await disconnect.remove();
    } catch (error) {
      await remove(room).catch(() => {});
      throw error;
    }
    watch(ref(database, path + '/students'), students => events.count(Object.keys(students ?? {}).length));
    watch(owner, uid => {
      if (uid !== user.uid) events.warning('La sessió s’ha tancat. Crea’n una de nova.');
    });
  } else {
    let joined = false;
    let teacherUid;
    let online = false;
    let registering = false;
    let pageRevision;

    async function register() {
      if (!teacherUid || !online || closed || registering) return;
      registering = true;
      try {
        await disconnect.remove();
        if (!closed && teacherUid && online) await set(student, true);
      } catch (error) {
        failed(error);
      } finally {
        registering = false;
      }
    }

    watch(connected, value => {
      online = value === true;
      if (online) {
        void register();
        void downloadPage();
      }
    });
    watch(owner, uid => {
      teacherUid = uid;
      if (!uid) {
        events.clearPage();
        shown = undefined;
        events.status(joined ? 'El professor ha tancat la sessió.' : 'Cercant la sessió del professor…');
        return;
      }
      joined = true;
      void register();
      if (!shown) events.status('Connectat. Esperant la pàgina del professor…');
    });
    watch(ref(database, path + '/state'), next => {
      state = next;
      if (shown === next?.revision && state) {
        events.view(state.view);
        events.ink(state.ink?.strokes ?? [], state.ink?.preview);
      }
    });
    async function downloadPage() {
      const expected = pageRevision;
      if (!online || !expected || (shown && shown >= expected) || pageDownload) return;
      const download = new AbortController();
      pageDownload = download;
      const started = performance.now();
      try {
        const frame = await request(path + '/frame', 'GET', undefined, download.signal);
        if (closed || download.signal.aborted || !frame || frame.revision < expected) return;
        const view = state?.revision === frame.revision ? state.view : frame.view;
        const bytes = Uint8Array.from(atob(frame.image), value => value.charCodeAt(0));
        shown = frame.revision;
        events.page(new Blob([bytes], { type: frame.type }), { page: frame.page, total: frame.total, view });
        if (state?.revision === shown) events.ink(state.ink?.strokes ?? [], state.ink?.preview);
        events.status('');
        console.debug('THOSBOARD · Descàrrega de pàgina', frame.page, Math.round(performance.now() - started), 'ms');
      } catch (error) {
        if (!download.signal.aborted) failed(error);
      } finally {
        if (pageDownload === download) pageDownload = undefined;
      }
    }

    watch(ref(database, path + '/frame/revision'), next => {
      pageRevision = next;
      pageDownload?.abort();
      pageDownload = undefined;
      if (!next) {
        shown = undefined;
        events.clearPage();
        if (teacherUid) events.status('Connectat. Esperant la pàgina del professor…');
        return;
      }
      void downloadPage();
    });
  }

  function changeState(key, value) {
    if (!teacher || closed || !frameState) return;
    frameState = { ...frameState, [key]: value };
    pending[key] = value;
    if (timer) return;
    const current = revision;
    timer = setTimeout(() => {
      timer = undefined;
      const changes = pending;
      pending = {};
      enqueue(() => current === revision ? update(ref(database, path + '/state'), changes) : undefined);
    }, 80);
  }

  function resetPending() {
    clearTimeout(timer);
    timer = undefined;
    pending = {};
  }

  return {
    clear() {
      resetPending();
      frameState = undefined;
      ++revision;
      enqueue(() => update(room, { frame: null, state: null }));
    },
    publish(image, page, total, view, strokes = [], preview = null) {
      resetPending();
      const current = ++revision;
      frameState = { revision: current, view, ink: { strokes, preview } };
      enqueue(async () => {
        if (current !== revision) return;
        const data = await encode(image);
        if (closed || current !== revision) return;
        const started = performance.now();
        await request(path, 'PATCH', {
          frame: { revision: current, image: data, page, total, type: image.type, view: frameState.view },
          state: frameState,
        });
        console.debug('THOSBOARD · Pujada de pàgina', page, image.size, 'bytes', Math.round(performance.now() - started), 'ms');
      });
    },
    updateView(view) {
      changeState('view', view);
    },
    updateInk(strokes, preview) {
      changeState('ink', { strokes, preview: preview ? { ...preview } : null });
    },
    async close() {
      closed = true;
      pageDownload?.abort();
      resetPending();
      for (const stop of listeners) stop();
      const target = teacher ? room : student;
      // Keep the disconnect cleanup registered until the explicit deletion succeeds.
      void remove(target).then(() => disconnect.cancel()).catch(() => {});
    },
  };
}
