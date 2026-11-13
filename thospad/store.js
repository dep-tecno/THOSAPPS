const modes = {
  wall: 'Mur',
  columns: 'Columnes',
  table: 'Taula',
  timeline: 'Cronologia',
  map: 'Mapa geogràfic'
};

const wallFormats = {
  wall: modes.wall,
  table: modes.table,
  rows: 'Files',
  list: 'Llista',
  columns: modes.columns,
  free: 'Forma lliure'
};

const defaultTableColumns = [
  { id: 'title', label: 'Títol' },
  { id: 'body', label: 'Publicació' },
  { id: 'group', label: 'Etiqueta' },
  { id: 'date', label: 'Data' },
  { id: 'place', label: 'Lloc' }
];

function normalizeBoard(board) {
  const type = board.type || (['timeline', 'map'].includes(board.mode) ? board.mode : 'wall');
  const mode = type === 'wall' && Object.hasOwn(wallFormats, board.mode) ? board.mode : type;
  return { ...board, type, mode };
}

const key = 'thospad:v1';
const example = {
  id: 'example',
  title: 'L’energia al nostre entorn',
  description: 'Recull d’idees i exemples per investigar com produïm i consumim energia.',
  type: 'wall',
  mode: 'wall',
  posts: [
    { id: '1', title: 'Plaques a la teulada', body: 'Quina part del consum del centre es podria cobrir amb energia solar?', group: 'Propostes', date: '', place: '', lat: null, lon: null },
    { id: '2', title: 'Parc eòlic del Perelló', body: 'Investiguem com es transforma l’energia del vent en electricitat.', group: 'Exemples', date: '', place: 'El Perelló', lat: 40.87, lon: 0.71 },
    { id: '3', title: 'Presentació de conclusions', body: 'Cada grup explica un cas i proposa una millora.', group: 'Fites', date: '2026-12-03', place: '', lat: null, lon: null }
  ]
};

function localStore(storage) {
  return {
    async list() {
      const raw = storage.getItem(key);
      if (raw === null) return [structuredClone(example)];
      const snapshot = JSON.parse(raw);
      if (snapshot.version !== 1 || !Array.isArray(snapshot.boards)) {
        throw new Error('Format de dades desconegut');
      }
      return snapshot.boards.map(normalizeBoard);
    },
    async save(boards) {
      storage.setItem(key, JSON.stringify({ version: 1, boards }));
    }
  };
}

function validPostDate(date) {
  if (date === '') return true;
  if (typeof date !== 'string' || !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(date) || date.startsWith('0000')) return false;
  const full = date.length === 4 ? date + '-01-01' : date.length === 7 ? date + '-01' : date;
  const parsed = new Date(full + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === full;
}

function postFrom(fields) {
  const { title, body, group, date, place, lat, lon } = fields;
  if (!validPostDate(date)) throw new Error('Revisa la data de la publicació.');
  const latitude = lat ? Number(lat) : null;
  const longitude = lon ? Number(lon) : null;
  if ((latitude === null) !== (longitude === null)) {
    throw new Error('Introdueix les dues coordenades.');
  }
  if (latitude !== null && (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180)) {
    throw new Error('Revisa els valors de latitud i longitud.');
  }
  return { title, body, group, date, place, lat: latitude, lon: longitude };
}
