import { pathToFileURL } from 'node:url';

const database = 'https://thospad-5ebd6-default-rtdb.europe-west1.firebasedatabase.app';
const rooms = '/thospad/rooms';
const idleLimit = 48 * 60 * 60 * 1000;

export function expired(room, now = Date.now()) {
  const since = room?.idleSince ?? (room?.access?.expiring === true ? room.access.created : undefined);
  return room?.access && !room.presence && Number.isFinite(since) && since <= now - idleLimit;
}

export async function cleanRooms(request, now = Date.now(), dryRun = false) {
  const ids = Object.keys(await (await request(rooms, { query: '?shallow=true' })).json() ?? {});
  let removed = 0;
  let candidates = 0;
  for (const id of ids) {
    if (!/^[a-f0-9]{32}$/.test(id)) continue;
    const path = rooms + '/' + id;
    const [access, idleSince, presence] = await Promise.all(['access', 'idleSince', 'presence'].map(async key =>
      (await request(path + '/' + key)).json()));
    if (!expired({ access, idleSince, presence }, now)) continue;
    const result = await request(path, { headers: { 'X-Firebase-ETag': 'true' } });
    const etag = result.headers.get('etag');
    if (!etag || !expired(await result.json(), now)) continue;
    candidates++;
    if (dryRun) continue;
    const deletion = await request(path, { method: 'DELETE', headers: { 'if-match': etag } });
    if (deletion.ok) removed++;
  }
  return { scanned: ids.length, candidates, removed };
}

async function main() {
  const token = process.env.FIREBASE_CLEANUP_ACCESS_TOKEN;
  if (!token) throw new Error('Falta el testimoni temporal de Google Cloud.');
  async function request(path, { query = '', method = 'GET', headers = {} } = {}) {
    const response = await fetch(database + path + '.json' + query, {
      method, headers: { ...headers, Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(20000)
    });
    if (!response.ok && !(method === 'DELETE' && response.status === 412)) {
      throw new Error('Firebase HTTP ' + response.status + ' (' + method + ')');
    }
    return response;
  }
  console.log(await cleanRooms(request, Date.now(), process.argv.includes('--dry-run')));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
