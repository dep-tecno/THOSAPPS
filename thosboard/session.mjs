const APP_ID = 'tecno-apps.cat/thosboard/v1';
const MAX_STUDENTS = 30;
export const MAX_FRAME_BYTES = 1024 * 1024;

export function randomCode() {
  const value = new Uint16Array(1);
  do {
    crypto.getRandomValues(value);
  } while (value[0] >= 60000);
  return String(value[0] % 10000).padStart(4, '0');
}

function validFrame(meta) {
  return Number.isSafeInteger(meta?.revision) && meta.revision > 0
    && Number.isSafeInteger(meta.page) && meta.page > 0
    && Number.isSafeInteger(meta.total) && meta.total >= meta.page
    && ['image/webp', 'image/jpeg', 'image/png'].includes(meta.type);
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
  const ask = room.makeAction('access');
  const admission = room.makeAction('admission');
  const frames = room.makeAction('page');
  const reset = room.makeAction('reset-page');
  const hosts = new Map();
  const requests = new Map();
  const students = new Map();

  let closed = false;
  let frame;
  let revision = 0;
  let shown = 0;
  let expected = '';
  let selected = null;
  let verifiedUserId = null;
  let admitted = false;

  function send(action, data, target) {
    return action.send(data, { target }).catch(() => {
      if (!closed) events.warning('S’ha interromput l’enviament. Si persisteix, torna a entrar a la sessió.');
    });
  }

  function updateTeacher() {
    if (!closed) events.roster(requests, students.size, MAX_STUDENTS);
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
    const candidates = [...hosts].filter(([, userId]) => verifiedUserId
      ? userId === verifiedUserId
      : userId.startsWith(expected));
    if (candidates.length > 1 && expected) {
      selected = null;
      admitted = false;
      shown = 0;
      events.clearPage();
      events.status('Identificador ambigu. Demana al professor que creï una sessió nova.');
      return;
    }
    if (selected || !expected) return;
    if (!candidates.length) {
      events.status('Esperant el professor amb aquest identificador…');
      return;
    }
    selected = candidates[0][0];
    events.status('Sol·licitud enviada. Esperant que el professor t’admeti…');
    void send(ask, 'request', selected);
  }

  room.onPeerJoin(({ peerId }) => {
    if (teacher && !closed) void send(hello, 'teacher', peerId);
  }, { replay: true });

  hello.onMessage((message, { peerId, userId }) => {
    if (closed || message !== 'teacher' || !/^[0-9A-Za-z]{22}$/.test(userId)) return;
    hosts.set(peerId, userId);
    events.collision(teacher || new Set(hosts.values()).size > 1);
    if (!teacher) findTeacher();
  });

  ask.onMessage((message, { peerId, userId }) => {
    if (closed || !teacher || hosts.has(peerId)) return;
    const student = students.get(peerId);
    if (message === 'ready' && student) {
      student.ready = true;
      void deliver(peerId, student);
    }
    if (message !== 'request') return;
    if (student) {
      void send(admission, 'admitted', peerId);
      return;
    }
    requests.set(peerId, userId);
    updateTeacher();
  });

  admission.onMessage((message, { peerId }) => {
    if (closed || teacher || selected !== peerId) return;
    if (message === 'admitted') {
      admitted = true;
      verifiedUserId = hosts.get(peerId);
      events.status('Connectat. Esperant la pàgina del professor…');
      void send(ask, 'ready', peerId);
    } else if (message === 'denied' || message === 'full') {
      selected = null;
      expected = '';
      verifiedUserId = null;
      events.status(message === 'full' ? 'La sessió és plena.' : 'El professor ha rebutjat la sol·licitud.');
    }
  });

  ask.onReceive(({ byteLength }) => teacher && byteLength <= 32);
  reset.onMessage((nextRevision, { peerId }) => {
    if (closed || teacher || !admitted || selected !== peerId
      || !Number.isSafeInteger(nextRevision) || nextRevision <= shown) return;
    shown = nextRevision;
    events.clearPage();
    events.status('Esperant la pàgina del professor…');
  });

  function accepts(peerId, metadata, byteLength) {
    return !closed && !teacher && admitted && selected === peerId && validFrame(metadata)
      && metadata.revision > shown && byteLength > 0 && byteLength <= MAX_FRAME_BYTES;
  }
  frames.onReceive(({ peerId, metadata, byteLength }) => accepts(peerId, metadata, byteLength));
  frames.onMessage((data, { peerId, metadata }) => {
    if (!(data instanceof Uint8Array) || !accepts(peerId, metadata, data.byteLength)) return;
    shown = metadata.revision;
    events.page(new Blob([data], { type: metadata.type }), metadata);
    events.status('');
  });

  room.onPeerLeave(({ peerId }) => {
    if (closed) return;
    hosts.delete(peerId);
    events.collision(teacher ? hosts.size > 0 : new Set(hosts.values()).size > 1);
    if (teacher) {
      requests.delete(peerId);
      students.delete(peerId);
      updateTeacher();
    } else if (peerId === selected) {
      selected = null;
      admitted = false;
      shown = 0;
      events.clearPage();
      events.status('Connexió amb el professor interrompuda. Esperant que es recuperi…');
      findTeacher();
    } else if (!selected && expected) {
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
    fingerprint: identity.userId.slice(0, 14),
    verify(value) {
      if (teacher || admitted || selected) return;
      expected = value;
      if (verifiedUserId && value !== verifiedUserId.slice(0, 14)) verifiedUserId = null;
      findTeacher();
    },
    decide(peerId, allow) {
      if (!requests.delete(peerId)) return;
      if (allow && students.size < MAX_STUDENTS) {
        students.set(peerId, { busy: false, sent: 0, ready: false });
        void send(admission, 'admitted', peerId);
      } else {
        void send(admission, allow ? 'full' : 'denied', peerId);
      }
      updateTeacher();
    },
    clear() {
      frame = null;
      ++revision;
      for (const [peerId, student] of students) {
        if (student.ready) void send(reset, revision, peerId);
      }
    },
    publish(image, page, total) {
      const meta = { revision: ++revision, page, total, type: image.type };
      frame = { image, meta };
      for (const [peerId, student] of students) {
        if (student.ready) void deliver(peerId, student);
      }
    },
    async close() {
      closed = true;
      frame = null;
      await room.leave();
    },
  };
}
