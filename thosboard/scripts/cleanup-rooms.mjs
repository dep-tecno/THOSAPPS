import { pathToFileURL } from 'node:url';
import { firebaseConfig } from '../firebase-config.mjs';

const gracePeriod = 15 * 60 * 1000;
const roomsPath = 'thosboard/rooms';

export async function cleanRooms({ databaseURL, token, dryRun, now = Date.now(), request = fetch }) {
  if (!token) throw new Error('Falta l’accés de servei a Firebase.');

  async function read(path, etag = false, shallow = false) {
    const url = new URL(path + '.json', databaseURL);
    if (shallow) url.searchParams.set('shallow', 'true');
    const headers = { Authorization: 'Bearer ' + token };
    if (etag) headers['X-Firebase-ETag'] = 'true';
    const response = await request(url, { headers, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Error de lectura a Firebase: HTTP ' + response.status);
    return { value: await response.json(), etag: response.headers.get('etag') };
  }

  function expired(expiresAt) {
    return Number.isFinite(expiresAt) && expiresAt <= now - gracePeriod;
  }

  const { value: rooms } = await read(roomsPath, false, true);
  const counts = { revisades: 0, caducades: 0, eliminades: 0, modificades: 0 };
  for (const code of Object.keys(rooms ?? {})) {
    if (!/^[0-9]{6}$/.test(code)) continue;
    const path = roomsPath + '/' + code;
    counts.revisades++;
    const { value: expiry } = await read(path + '/expiresAt');
    if (!expired(expiry)) continue;
    const { value: room, etag } = await read(path, true);
    if (!expired(room?.expiresAt)) continue;
    counts.caducades++;
    if (dryRun) continue;
    if (!etag) throw new Error('Firebase no ha retornat la versió de la sala.');

    const response = await request(new URL(path + '.json', databaseURL), {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + token,
        'If-Match': etag,
        'Content-Type': 'application/json',
      },
      body: 'null',
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 412) counts.modificades++;
    else if (!response.ok) throw new Error('Error de neteja a Firebase: HTTP ' + response.status);
    else counts.eliminades++;
  }
  return counts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dryRun = process.argv.includes('--dry-run');
  const counts = await cleanRooms({
    databaseURL: firebaseConfig.databaseURL,
    token: process.env.FIREBASE_CLEANUP_ACCESS_TOKEN,
    dryRun,
  });
  console.log(dryRun ? 'Simulació de neteja:' : 'Neteja completada:', counts);
}
