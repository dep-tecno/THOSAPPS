const APP_ID = 'tecno-apps.cat/thosboard/v2';
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
  const follow = room.makeAction('follow');
  const fingerprint = identity.userId.slice(0, 14);
  const frames = room.makeAction('page');
  const reset = room.makeAction('reset-page');
  const hosts = new Map();
  const students = new Map();

  let closed = false;
  let frame;
  let revision = 0;
  let shown = 0;
  let expected = '';
  let selected = null;
  let verifiedUserId = null;

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
    const candidates = [...hosts].filter(([, userId]) => verifiedUserId
      ? userId === verifiedUserId
      : userId.startsWith(expected));
    if (candidates.length > 1 && expected) {
      selected = null;
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
    verifiedUserId = candidates[0][1];
    events.status('Connectat. Esperant la pàgina del professor…');
    void send(follow, expected, selected);
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

  follow.onReceive(({ byteLength }) => teacher && byteLength === fingerprint.length);
  follow.onMessage((value, { peerId }) => {
    if (closed || !teacher || value !== fingerprint || hosts.has(peerId)) return;
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
    events.page(new Blob([data], { type: metadata.type }), metadata);
    events.status('');
  });

  room.onPeerLeave(({ peerId }) => {
    if (closed) return;
    hosts.delete(peerId);
    events.collision(teacher ? hosts.size > 0 : new Set(hosts.values()).size > 1);
    if (teacher) {
      if (students.delete(peerId)) updateTeacher();
    } else if (peerId === selected) {
      selected = null;
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
    fingerprint,
    verify(value) {
      if (teacher || selected) return;
      expected = value;
      if (verifiedUserId && value !== verifiedUserId.slice(0, 14)) verifiedUserId = null;
      findTeacher();
    },
    clear() {
      frame = null;
      ++revision;
      for (const peerId of students.keys()) void send(reset, revision, peerId);
    },
    publish(image, page, total) {
      const meta = { revision: ++revision, page, total, type: image.type };
      frame = { image, meta };
      for (const [peerId, student] of students) {
        void deliver(peerId, student);
      }
    },
    async close() {
      closed = true;
      frame = null;
      await room.leave();
    },
  };
}
