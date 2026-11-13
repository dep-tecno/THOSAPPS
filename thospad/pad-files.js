function makePadId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
}

function webLink(value) {
  if (typeof value !== 'string' || !value || value.length > 2048) return '';
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
  } catch {
    return '';
  }
  return '';
}

function validPostImage(value) {
  return typeof value === 'string' && value.length <= 400000 &&
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}

async function preparePostImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 12000000) {
    throw new Error('Tria una imatge JPG, PNG o WebP de fins a 12 MB.');
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    for (const size of [1000, 720, 480]) {
      const scale = Math.min(1, size / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL('image/webp', .78);
      if (validPostImage(data)) return data;
    }
  } catch {
    throw new Error('No s’ha pogut llegir aquesta imatge.');
  } finally {
    URL.revokeObjectURL(url);
  }
  throw new Error('La imatge ocupa massa espai. Tria una imatge més petita.');
}

function readPadFile(text) {
  const { format, version, pad } = JSON.parse(text);
  const isExtraColumn = id => typeof id === 'string' && /^extra-[a-f0-9]{32}$/.test(id);
  const validColumns = columns => columns === undefined || (Array.isArray(columns) &&
    columns.length >= defaultTableColumns.length &&
    columns.every((column, index) => column &&
      (index < defaultTableColumns.length ? column.id === defaultTableColumns[index].id : isExtraColumn(column.id)) &&
      typeof column.label === 'string' && column.label.trim() && column.label.length <= 60) &&
    new Set(columns.map(column => column.id)).size === columns.length);
  const validTableValues = values => values === undefined || (values && typeof values === 'object' &&
    !Array.isArray(values) && Object.entries(values).every(([id, value]) =>
      isExtraColumn(id) && typeof value === 'string' && value.length <= 500));
  const validPosition = position => position === undefined || (position &&
    ([position.x, position.y].every(value => Number.isFinite(value) && value >= 0 && value <= 100000) ||
      (Number.isInteger(position.column) && position.column >= 0 && position.column < 3 &&
        Number.isInteger(position.row) && position.row >= 0 && position.row <= 5000)));
  const validPost = post => post &&
    ['id', 'title', 'body', 'group', 'date', 'place'].every(field => typeof post[field] === 'string') &&
    validPostDate(post.date) &&
    ((post.lat === null && post.lon === null) ||
      (Number.isFinite(post.lat) && Math.abs(post.lat) <= 90 && Number.isFinite(post.lon) && Math.abs(post.lon) <= 180)) &&
    validPosition(post.position) && validTableValues(post.tableValues) &&
    (post.tableDateText === undefined || (typeof post.tableDateText === 'string' && post.tableDateText.length <= 500)) &&
    (post.image === undefined || validPostImage(post.image)) &&
    (post.link === undefined || post.link === '' || Boolean(webLink(post.link)));
  if (format !== 'THOSPAD' || version !== 1 || !pad ||
      typeof pad.title !== 'string' || !pad.title.trim() || typeof pad.description !== 'string' ||
      !Object.hasOwn(modes, pad.type) || !validColumns(pad.tableColumns) || !Array.isArray(pad.posts) || !pad.posts.every(validPost) ||
      new Set(pad.posts.map(post => post.id)).size !== pad.posts.length) {
    throw new Error('Fitxer PAD incorrecte');
  }
  const theme = [...document.querySelectorAll('input[name="theme"]')].some(input => input.value === pad.theme)
    ? pad.theme : 'forest';
  return normalizeBoard({ ...pad, theme });
}

function downloadPadFile(blob, title, extension) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = (title.replace(/[<>:"/\\|?*]/g, '-').trim().slice(0, 100) || 'PAD') + '.' + extension;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function padPhoto(surface) {
  const copy = surface.cloneNode(true);
  const originals = [surface, ...surface.querySelectorAll('*')];
  const clones = [copy, ...copy.querySelectorAll('*')];
  originals.forEach((original, index) => {
    const clone = clones[index];
    const style = getComputedStyle(original);
    for (const name of style) {
      if (!name.startsWith('--')) clone.style.setProperty(name, style.getPropertyValue(name));
    }
    if (original.scrollWidth > original.clientWidth && ['auto', 'scroll'].includes(style.overflowX)) {
      clone.style.overflowX = 'visible';
    }
  });
  const left = surface.getBoundingClientRect().left;
  const width = Math.max(surface.offsetWidth, ...originals.filter(node => node instanceof HTMLElement &&
    node.scrollWidth > node.clientWidth && ['auto', 'scroll'].includes(getComputedStyle(node).overflowX))
    .map(node => Math.ceil(node.getBoundingClientRect().left - left + node.scrollWidth)));
  const height = surface.offsetHeight;
  copy.style.margin = '0';
  copy.style.minHeight = '0';
  copy.querySelectorAll('button:not(#edit-pad), .edit-pad-icon').forEach(node => {
    node.style.display = 'none';
  });
  copy.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  const tiles = [...copy.querySelectorAll('.map-tiles image')];
  const embedded = await Promise.allSettled(tiles.map(async tile => {
    const response = await fetch(tile.getAttribute('href'));
    if (!response.ok) throw new Error('Cartografia no disponible');
    const blob = await response.blob();
    const url = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    tile.setAttribute('href', url);
  }));
  if (embedded.some(result => result.status === 'rejected')) {
    copy.querySelector('.map-tiles').replaceChildren();
    copy.querySelector('.map-names').style.visibility = 'visible';
  }
  const markup = new XMLSerializer().serializeToString(copy);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height +
    '"><foreignObject width="100%" height="100%">' + markup + '</foreignObject></svg>';
  const image = new Image();
  image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await image.decode();
  const scale = Math.min(2, 8192 / Math.max(width, height), Math.sqrt(16000000 / (width * height)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(width * scale));
  canvas.height = Math.max(1, Math.floor(height * scale));
  const context = canvas.getContext('2d');
  context.fillStyle = getComputedStyle(surface).getPropertyValue('--paper').trim() || '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG no disponible')), 'image/png');
  });
}
