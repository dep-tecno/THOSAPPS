import { sign } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const database = 'https://thospad-5ebd6-default-rtdb.europe-west1.firebasedatabase.app';
const rooms = '/thospad/rooms';
const tokenUrl = 'https://oauth2.googleapis.com/token';
const idleLimit = 48 * 60 * 60 * 1000;

export function expired(room, now = Date.now()) {
  const since = room?.idleSince ?? (room?.access?.expiring === true ? room.access.created : undefined);
  return room?.access && !room.presence && Number.isFinite(since) && since <= now - idleLimit;
}

export async function cleanRooms(request, now = Date.now()) {
  const ids = Object.keys(await (await request(rooms, { query: '?shallow=true' })).json() ?? {});
  let removed = 0;
  for (const id of ids) {
    if (!/^[a-f0-9]{32}$/.test(id)) continue;
    const path = rooms + '/' + id;
    const [access, idleSince, presence] = await Promise.all(['access', 'idleSince', 'presence'].map(async key =>
      (await request(path + '/' + key)).json()));
    if (!expired({ access, idleSince, presence }, now)) continue;
    const result = await request(path, { headers: { 'X-Firebase-ETag': 'true' } });
    const etag = result.headers.get('etag');
    if (!etag || !expired(await result.json(), now)) continue;
    const deletion = await request(path, { method: 'DELETE', headers: { 'if-match': etag } });
    if (deletion.ok) removed++;
  }
  return { scanned: ids.length, removed };
}

async function main() {
  const credentials = JSON.parse(process.env.THOSPAD_CLEANUP_CREDENTIALS ?? '{}');
  if (credentials.project_id !== 'thospad-5ebd6' || !credentials.client_email || !credentials.private_key) {
    throw new Error('Configura les credencials del projecte thospad-5ebd6.');
  }
  const now = Math.floor(Date.now() / 1000);
  const encode = data => Buffer.from(JSON.stringify(data)).toString('base64url');
  const claims = {
    iss: credentials.client_email, aud: tokenUrl, iat: now, exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email'
  };
  const unsigned = encode({ alg: 'RS256', typ: 'JWT' }) + '.' + encode(claims);
  const assertion = unsigned + '.' + sign('RSA-SHA256', Buffer.from(unsigned), credentials.private_key).toString('base64url');
  const result = await fetch(tokenUrl, { method: 'POST',
    body: new URLSearchParams({ assertion, grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer' }),
    signal: AbortSignal.timeout(20000)
  });
  if (!result.ok) throw new Error('OAuth HTTP ' + result.status);
  const { access_token: token } = await result.json();
  async function request(path, { query = '', method = 'GET', headers = {} } = {}) {
    const response = await fetch(database + path + '.json' + query, {
      method, headers: { ...headers, Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(20000)
    });
    if (!response.ok && !(method === 'DELETE' && response.status === 412)) {
      throw new Error('Firebase HTTP ' + response.status + ' (' + method + ')');
    }
    return response;
  }
  console.log(await cleanRooms(request));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
