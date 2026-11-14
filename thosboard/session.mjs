const APP_ID = 'tecno-apps.cat/thosboard/v4';
export const MAX_FRAME_BYTES = 1024 * 1024;

export function randomCode() {
  const value = new Uint32Array(1);
  do {
    crypto.getRandomValues(value);
  } while (value[0] >= 4294000000);
  return String(value[0] % 1000000).padStart(6, '0');
}

function validView(state) {
  return Number.isFinite(state?.zoom) && state.zoom >= 1 && state.zoom <= 4
    && [0, 90, 180, 270].includes(state.rotation)
    && Number.isFinite(state.x) && Math.abs(state.x) <= .5
    && Number.isFinite(state.y) && Math.abs(state.y) <= .5;
}

function validFrame(meta) {
  return Number.isSafeInteger(meta?.revision) && meta.revision > 0
    && Number.isSafeInteger(meta.page) && meta.page > 0
    && Number.isSafeInteger(meta.total) && meta.total >= meta.page
    && ['image/webp', 'image/jpeg', 'image/png'].includes(meta.type)
    && validView(meta.view) && Number.isSafeInteger(meta.viewVersion) && meta.viewVersion >= 0;
}

export async function openSession(code, teacher, events) {
  const { createUserIdentity, joinRoom } = await import('./transport.bundle.mjs');
  const identity = await createUserIdentity();
  const room = joinRoom({
    appId: APP_ID,
    identity,
    passive: !teacher,
    maxReceiveBytes: MAX_FRAME_BYTES,
  }, code);
  const hello = room.makeAction('teacher');
  const follow = room.makeAction('follow');
  const frames = room.makeAction('page');
  const reset = room.makeAction('reset-page');
  const views = room.makeAction('view');
  const hosts = new Map();
  const students = new Map();

  let closed = false;
  let frame;
  let revision = 0;
  let shown = 0;
  let viewVersion = 0;
  let pendingView;
  let viewTimer;
  let discoveryTimer;
  let collision = false;
  let selected = null;
  let selectedUserId = null;

  function send(action, data, target) {
    return action.send(data, { target }).catch(() => {
      if (!closed) events.warning('S’ha interromput l’enviament. Si persisteix, torna a entrar a la sessió.');
    });
  }

  function updateTeacher() {
    if (!closed) events.count(students.size);
  }

  async function deliver(peerId, student) {
    if (!frame || student.busy || closed || student.sent === frame.meta.revision) return;
    student.busy = true;
    const current = frame;
    try {
      await frames.send(current.image, { target: peerId, metadata: current.meta });
    } catch {
      if (!closed && students.has(peerId) && frame === current) {
        events.warning('Un alumne no ha rebut la pàgina. Pot tornar a entrar si la connexió no es recupera.');
      }
    } finally {
      student.sent = current.meta.revision;
      student.busy = false;
      if (!closed && students.get(peerId) === student && frame !== current) void deliver(peerId, student);
    }
  }

  function findTeacher() {
    clearTimeout(discoveryTimer);
    if (collision || selected || hosts.size !== 1) return;
    discoveryTimer = setTimeout(() => {
      const [[peerId, userId]] = hosts;
      if (selectedUserId && selectedUserId !== userId) return;
      selected = peerId;
      selectedUserId = userId;
      events.status('Connectat. Esperant la pàgina del professor…');
      void send(follow, code, peerId);
    }, selectedUserId ? 0 : 2000);
  }

  room.onPeerJoin(({ peerId }) => {
    if (teacher && !closed) void send(hello, 'teacher', peerId);
  }, { replay: true });

  hello.onMessage((message, { peerId, userId }) => {
    if (closed || message !== 'teacher' || !/^[0-9A-Za-z]{22}$/.test(userId)) return;
    hosts.set(peerId, userId);
    if (teacher) {
      events.collision(true);
    } else if (hosts.size > 1 || (selectedUserId && userId !== selectedUserId)) {
      collision = true;
      selected = null;
      clearTimeout(discoveryTimer);
      events.clearPage();
      events.status('');
      events.collision(true);
    } else {
      findTeacher();
    }
  });

  follow.onReceive(({ byteLength }) => teacher && byteLength === code.length);
  follow.onMessage((value, { peerId }) => {
    if (closed || !teacher || value !== code || hosts.has(peerId)) return;
    if (!students.has(peerId)) {
      students.set(peerId, { busy: false, sent: 0 });
      updateTeacher();
    }
    void deliver(peerId, students.get(peerId));
  });
  reset.onMessage((nextRevision, { peerId }) => {
    if (closed || teacher || selected !== peerId
      || !Number.isSafeInteger(nextRevision) || nextRevision <= shown) return;
    shown = nextRevision;
    if (pendingView?.revision <= shown) pendingView = undefined;
    events.clearPage();
    events.status('Esperant la pàgina del professor…');
  });

  function accepts(peerId, metadata, byteLength) {
    return !closed && !teacher && selected === peerId && validFrame(metadata)
      && metadata.revision > shown && byteLength > 0 && byteLength <= MAX_FRAME_BYTES;
  }
  frames.onReceive(({ peerId, metadata, byteLength }) => accepts(peerId, metadata, byteLength));
  frames.onMessage((data, { peerId, metadata }) => {
    if (!(data instanceof Uint8Array) || !accepts(peerId, metadata, data.byteLength)) return;
    shown = metadata.revision;
    if (pendingView?.revision === shown && pendingView.viewVersion > metadata.viewVersion) {
      metadata = { ...metadata, view: pendingView.view, viewVersion: pendingView.viewVersion };
    }
    if (pendingView?.revision <= shown) pendingView = undefined;
    viewVersion = metadata.viewVersion;
    events.page(new Blob([data], { type: metadata.type }), metadata);
    events.status('');
  });
  views.onMessage((message, { peerId }) => {
    if (closed || teacher || selected !== peerId || !validView(message?.view)
      || !Number.isSafeInteger(message.revision) || message.revision < shown
      || !Number.isSafeInteger(message.viewVersion) || message.viewVersion < 1) return;
    if (message.revision === shown) {
      if (message.viewVersion <= viewVersion) return;
      viewVersion = message.viewVersion;
      events.view(message.view);
    } else if (!pendingView || message.revision > pendingView.revision
      || (message.revision === pendingView.revision && message.viewVersion > pendingView.viewVersion)) {
      pendingView = message;
    }
  });

  room.onPeerLeave(({ peerId }) => {
    if (closed) return;
    hosts.delete(peerId);
    if (teacher) events.collision(hosts.size > 0);
    if (teacher) {
      if (students.delete(peerId)) updateTeacher();
    } else if (peerId === selected) {
      selected = null;
      shown = 0;
      pendingView = undefined;
      events.clearPage();
      events.status('Connexió amb el professor interrompuda. Esperant que es recuperi…');
      findTeacher();
    } else if (!selected) {
      findTeacher();
    }
  });
  room.onError(({ code: errorCode }) => {
    if (!closed && errorCode === 'relay-failed') events.warning('Els serveis de descoberta no responen. Comprova la connexió i torna-ho a provar.');
  });

  try {
    await room.ready;
  } catch (error) {
    await room.leave();
    throw error;
  }

  return {
    clear() {
      frame = null;
      ++revision;
      for (const peerId of students.keys()) void send(reset, revision, peerId);
    },
    publish(image, page, total, view) {
      const meta = { revision: ++revision, page, total, type: image.type, view, viewVersion: 0 };
      frame = { image, meta };
      for (const [peerId, student] of students) {
        void deliver(peerId, student);
      }
    },
    updateView(view) {
      if (!teacher || closed || !frame) return;
      frame.meta = { ...frame.meta, view, viewVersion: frame.meta.viewVersion + 1 };
      if (viewTimer) return;
      viewTimer = setTimeout(() => {
        viewTimer = undefined;
        if (!frame) return;
        const { revision, view, viewVersion } = frame.meta;
        for (const peerId of students.keys()) void send(views, { revision, view, viewVersion }, peerId);
      }, 50);
    },
    async close() {
      closed = true;
      clearTimeout(discoveryTimer);
      clearTimeout(viewTimer);
      frame = null;
      await room.leave();
    },
  };
}
