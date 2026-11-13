
const byId = id => document.getElementById(id);
const picker = byId('boards');
const content = byId('content');
const dialog = byId('editor');
const form = byId('edit-form');
const status = byId('status');
const editorStatus = byId('editor-status');
const views = byId('views');
const padMode = byId('pad-mode');
let presenting = false;
const mapPicker = byId('map-picker');
let mapPoint;
let mapSelection;
const timelineDirection = byId('timeline-direction');
const deleteDialog = byId('delete-dialog');
const deleteButton = byId('delete-pad');
const deleteStatus = byId('delete-status');
let pendingDeleteId;
const dateFormat = new Intl.DateTimeFormat('ca', { dateStyle: 'long', timeZone: 'UTC' });
const monthFormat = new Intl.DateTimeFormat('ca', { year: 'numeric', month: 'long', timeZone: 'UTC' });
const datePrecision = byId('date-precision');
const tableFieldControls = {
  title: byId('post-title-label').parentElement,
  body: byId('body-label'),
  group: byId('post-group-label').parentElement,
  date: datePrecision.closest('fieldset'),
  place: form.querySelector('[data-field="place"]')
};
const tableFieldAnchors = Object.fromEntries(Object.entries(tableFieldControls).map(([id, field]) => {
  const anchor = document.createComment(id);
  field.before(anchor);
  return [id, anchor];
}));
const postFieldsByMode = {
  timeline: ['date'],
  map: ['place', 'coordinates']
};
let store;
let boards;
let activeId;
let creatingBoard;
let editingPad;
let editingPost;
let currentImage;
let imageRequest = 0;
let saving = false;

function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  if (className) node.className = className;
  return node;
}

function card(post, detail) {
  const node = element('article', undefined, 'pad-card');
  if (post.size) {
    node.style.setProperty('--card-width', post.size.width + 'px');
    node.style.minHeight = post.size.height + 'px';
  }
  if (detail) node.append(element('small', detail));
  if (post.group && post.group !== detail) node.append(element('small', post.group));
  node.append(element('h3', post.title));
  if (post.body) node.append(element('p', post.body));
  addPostAttachments(node, post);
  enablePostEditing(node, node, post);
  if (!presenting) addCardResize(node, post);
  return node;
}

function addCardResize(node, post) {
  const handle = element('button', '◢', 'resize-card');
  handle.type = 'button';
  handle.title = 'Canvia la mida de la targeta';
  handle.setAttribute('aria-label', 'Canvia la mida de «' + post.title + '» amb les fletxes');
  node.append(handle);
  let drag;
  const measure = () => ({ width: node.offsetWidth, height: node.offsetHeight });
  const limit = (value, min, max) => Math.round(Math.max(min, Math.min(max, value)));
  function apply(width, height) {
    const size = { width: limit(width, 144, 960), height: limit(height, 88, 960) };
    node.style.setProperty('--card-width', size.width + 'px');
    node.style.minHeight = size.height + 'px';
    return size;
  }
  async function save(size, previous) {
    const pad = activeBoard();
    const posts = pad.posts.map(item => item.id === post.id ? { ...item, size } : item);
    const next = boards.map(item => item.id === pad.id ? { ...pad, posts } : item);
    if (!await persist(next, pad.id, status, false)) {
      node.style.setProperty('--card-width', previous.width);
      node.style.minHeight = previous.height;
    } else {
      const layout = node.closest('.free');
      if (layout) {
        layout.style.minHeight = Math.max(layout.clientHeight, node.offsetTop + node.offsetHeight + 16) + 'px';
      }
    }
  }
  const currentStyle = () => ({
    width: node.style.getPropertyValue('--card-width'), height: node.style.minHeight
  });
  handle.addEventListener('pointerdown', event => {
    if (saving || !event.isPrimary || event.button !== 0) return;
    handle.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, start: measure(), previous: currentStyle() };
  });
  handle.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    if (event.clientX === drag.x && event.clientY === drag.y && !drag.size) return;
    drag.size = apply(drag.start.width + event.clientX - drag.x, drag.start.height + event.clientY - drag.y);
  });
  handle.addEventListener('pointerup', event => {
    if (drag?.id !== event.pointerId) return;
    const { size, previous } = drag;
    drag = null;
    if (size) void save(size, previous);
  });
  handle.addEventListener('lostpointercapture', () => {
    if (!drag) return;
    node.style.setProperty('--card-width', drag.previous.width);
    node.style.minHeight = drag.previous.height;
    drag = null;
  });
  handle.addEventListener('keydown', event => {
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!delta) return;
    event.preventDefault();
    if (saving || drag) return;
    const previous = currentStyle();
    const { width, height } = measure();
    void save(apply(width + delta[0] * 16, height + delta[1] * 16), previous);
  });
}

function addPostAttachments(node, post) {
  if (validPostImage(post.image)) {
    const image = element('img', undefined, 'post-image');
    image.alt = 'Imatge de «' + post.title + '»';
    image.src = post.image;
    node.append(image);
  }
  const url = webLink(post.link);
  if (url) {
    const link = element('a', 'Obre l’enllaç', 'post-link');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    node.append(link);
  }
}

function enablePostEditing(container, actionCell, post) {
  if (presenting) return;
  const button = element('button', 'Edita', 'edit-post');
  button.type = 'button';
  button.setAttribute('aria-label', 'Edita «' + post.title + '»');
  button.addEventListener('click', () => openEditor(false, post));
  container.addEventListener('dblclick', event => {
    if (!event.target.closest('button, a')) openEditor(false, post);
  });
  actionCell.append(button);
}

function displayDate(date) {
  if (!date) return 'Sense data';
  if (date.length === 4) return String(Number(date));
  if (date.length === 7) return monthFormat.format(new Date(date + '-01T00:00:00Z'));
  return dateFormat.format(new Date(date + 'T00:00:00Z'));
}

function renderTable(board) {
  const editable = !presenting && board.type === 'table';
  const columns = board.type === 'table' ? board.tableColumns ?? defaultTableColumns : defaultTableColumns;
  const wrap = element('div', undefined, 'table-wrap');
  const table = element('table');
  table.setAttribute('aria-label', 'Taula de publicacions');
  const header = table.createTHead().insertRow();
  for (const column of columns) {
    const cell = element('th');
    cell.scope = 'col';
    if (editable) {
      const button = element('button', column.label + ' ✎', 'column-button');
      button.setAttribute('aria-label', 'Edita la columna «' + column.label + '»');
      button.addEventListener('click', () => editTableHeader(board, columns, cell, button, column));
      cell.append(button);
    } else cell.textContent = column.label;
    header.append(cell);
  }
  if (editable) {
    const cell = element('th');
    const button = element('button', '+ Columna', 'column-button');
    button.addEventListener('click', () => editTableHeader(board, columns, cell, button));
    cell.append(button);
    header.append(cell);
  }
  const body = table.createTBody();
  for (const post of board.posts) {
    const row = body.insertRow();
    row.dataset.postId = post.id;
    for (const column of columns) {
      const cell = row.insertCell();
      const value = column.id === 'date' ? (column.label !== 'Data' ? post.tableDateText : undefined) ?? (post.date && displayDate(post.date))
        : column.id.startsWith('extra-') ? post.tableValues?.[column.id] : post[column.id];
      cell.textContent = value || '—';
      if (column.id === 'body') addPostAttachments(cell, post);
      if (column.id === 'title') enablePostEditing(row, cell, post);
    }
    if (editable) row.insertCell();
  }
  wrap.append(table);
  content.append(wrap);
}

function editTableHeader(board, columns, cell, trigger, column) {
  if (saving) return;
  content.querySelector('.column-editor button[type="button"]')?.click();
  const editor = element('form', undefined, 'column-editor');
  const input = element('input');
  input.required = true;
  input.maxLength = 60;
  input.value = column?.label ?? '';
  input.placeholder = 'Nom de la columna';
  input.setAttribute('aria-label', 'Nom de la columna');
  const save = element('button', 'Desa');
  const cancel = element('button', 'Cancel·la');
  cancel.type = 'button';
  function close() {
    cell.replaceChildren(trigger);
    trigger.focus();
  }
  cancel.addEventListener('click', close);
  editor.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
  });
  editor.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    const label = input.value.trim();
    if (!label) {
      input.value = '';
      input.reportValidity();
      return;
    }
    const tableColumns = column ? columns.map(item => item.id === column.id ? { ...item, label } : item)
      : [...columns, { id: 'extra-' + makePadId(), label }];
    const next = boards.map(item => item.id === board.id ? { ...item, tableColumns } : item);
    const index = column ? columns.indexOf(column) : columns.length;
    if (await persist(next, board.id, status)) content.querySelectorAll('.column-button')[index].focus();
  });
  editor.append(input, save, cancel);
  cell.replaceChildren(editor);
  input.select();
  input.focus();
}

function svg(tag, attributes) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

function renderMap(posts) {
  const figure = element('figure', undefined, 'map');
  const map = svg('svg', { id: 'pad-map', viewBox: '0 0 720 360', role: 'group', 'aria-label': 'Mapa polític mundial' });
  const located = posts.filter(post => post.lat !== null && post.lon !== null);
  const countries = svg('g', { class: 'map-countries', 'aria-hidden': 'true' });
  const names = svg('g', { class: 'map-names', 'aria-hidden': 'true' });
  for (const country of mapCountries) {
    countries.append(svg('path', { d: country.path }));
    const name = svg('text', { x: country.x, y: country.y, 'data-rank': country.rank });
    name.textContent = country.name;
    names.append(name);
  }
  map.append(countries, names);
  const controls = element('div', undefined, 'map-controls');
  const markers = [];
  const tiles = svg('g', { class: 'map-tiles', 'aria-hidden': 'true', 'pointer-events': 'none' });
  map.insertBefore(tiles, names);
  const tileNodes = new Map();
  const onlineTiles = ['http:', 'https:'].includes(location.protocol);
  let tileFrame;
  function updateTiles() {
    if (!onlineTiles) return;
    const z = Math.max(0, Math.min(17, Math.round(Math.log2(720 * map.clientWidth / (256 * width)))));
    if (z < 5) {
      tiles.replaceChildren();
      tileNodes.clear();
      names.style.visibility = '';
      return;
    }
    const count = 2 ** z;
    const size = 720 / count;
    const halfHeight = width * map.clientHeight / Math.max(1, map.clientWidth) / 2;
    const wanted = new Set();
    for (let x = Math.max(0, Math.floor((cx - width / 2) / size)); x < count && x * size < cx + width / 2; x++) {
      for (let y = Math.max(0, Math.floor((cy - halfHeight) / size)); y < count && y * size < cy + halfHeight; y++) {
        const key = [z, x, y].join('/');
        wanted.add(key);
        if (tileNodes.has(key)) continue;
        const tile = svg('image', { x: x * size, y: y * size, width: size, height: size,
          href: 'https://tile.openstreetmap.org/' + key + '.png' });
        tile.addEventListener('error', () => { names.style.visibility = ''; });
        tileNodes.set(key, tile);
        tiles.append(tile);
      }
    }
    for (const [key, tile] of tileNodes) {
      if (wanted.has(key)) continue;
      tile.remove();
      tileNodes.delete(key);
    }
    names.style.visibility = wanted.size ? 'hidden' : '';
  }
  let width = 720;
  let cx = 360;
  let cy = 180;
  function setView(x, y, size) {
    const heightRatio = map.clientHeight / Math.max(1, map.clientWidth) || .5;
    width = Math.max(onlineTiles ? .035 : 22.5, Math.min(720, size));
    const height = width * heightRatio;
    cx = Math.max(width / 2, Math.min(720 - width / 2, x));
    cy = height >= 720 ? 360 : Math.max(height / 2, Math.min(720 - height / 2, y));
    map.setAttribute('viewBox', [cx - width / 2, cy - height / 2, width, height].join(' '));
    clearTimeout(tileFrame);
    tileFrame = setTimeout(() => { if (map.isConnected) updateTiles(); }, 100);
    names.style.fontSize = (width / 135) + 'px';
    for (const name of names.children) name.style.display = Number(name.dataset.rank) > (width > 360 ? 3 : 9) ? 'none' : '';
    for (const [marker, px, py] of markers) {
      marker.setAttribute('transform', 'translate(' + px + ' ' + py + ') scale(' + width / 720 + ')');
    }
    draft.setAttribute('r', 8 * width / 720);
  }
  for (const [label, action] of [
    ['−', () => setView(cx, cy, width * 2)],
    ['+', () => setView(cx, cy, width / 2)],
    ['Centra', centerMap]
  ]) {
    const button = element('button', label);
    button.setAttribute('aria-label', label === '−' ? 'Allunya el mapa' : label === '+' ? 'Apropa el mapa' : 'Centra el mapa');
    button.addEventListener('click', action);
    controls.append(button);
  }
  function centerMap() {
    if (!located.length) return setView(360, 360, 720);
    const xs = located.map(post => 360 + post.lon * 2);
    const ys = located.map(post => mapLatitudeY(post.lat));
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    setView((minX + maxX) / 2, (minY + maxY) / 2, Math.max(90, (maxX - minX) * 1.2, (maxY - minY) * 2.4));
  }
  const list = element('ol', undefined, 'map-list');
  const pointList = element('details', undefined, 'map-points');
  const summary = element('summary', '☷');
  summary.title = 'Punts del PAD';
  summary.setAttribute('aria-label', 'Punts del PAD (' + located.length + ')');
  pointList.append(summary, list);
  if (located.length) controls.prepend(pointList);
  const selectedPost = element('div', undefined, 'map-selected-post');
  selectedPost.hidden = true;
  located.forEach((post, index) => {
    const x = 360 + post.lon * 2;
    const y = mapLatitudeY(post.lat);
    const pin = svg('circle', { r: 8, fill: '#233544', stroke: '#fff' });
    const label = svg('text', { y: 3, fill: '#fff', 'text-anchor': 'middle', 'font-size': 9 });
    label.textContent = index + 1;
    const marker = svg('g', { tabindex: 0, role: 'button', 'aria-label': post.title });
    marker.append(pin, label);
    markers.push([marker, x, y]);
    map.append(marker);
    const item = element('li');
    const jump = element('button', post.place || post.title);
    jump.type = 'button';
    item.append(jump);
    const showPost = () => {
      if (!mapPicker.hidden) return;
      const close = element('button', 'Tanca');
      close.type = 'button';
      close.addEventListener('click', () => {
        selectedPost.hidden = true;
        marker.focus();
      });
      selectedPost.replaceChildren(close, card(post, post.place));
      selectedPost.hidden = false;
    };
    jump.addEventListener('click', () => {
      if (!mapPicker.hidden) return;
      setView(x, y, Math.min(width, 45));
      pointList.open = false;
      summary.focus({ preventScroll: true });
      showPost();
    });
    marker.addEventListener('click', showPost);
    marker.addEventListener('keydown', event => {
      if (!['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      showPost();
    });
    list.append(item);
  });
  const draft = svg('circle', { r: 8, fill: '#ff6295', stroke: '#fff', 'stroke-width': 2, hidden: '' });
  map.append(draft);
  map.addEventListener('wheel', event => {
    event.preventDefault();
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(map.getScreenCTM().inverse());
    const next = Math.max(onlineTiles ? .035 : 22.5, Math.min(720, width * (event.deltaY < 0 ? .8 : 1.25)));
    const ratio = next / width;
    setView(point.x + (cx - point.x) * ratio, point.y + (cy - point.y) * ratio, next);
  }, { passive: false });
  let pan;
  map.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    if (mapPicker.hidden) {
      if (!event.target.closest('[role="button"]')) {
        pan = { id: event.pointerId, x: event.clientX, y: event.clientY, cx, cy };
        map.setPointerCapture(event.pointerId);
      }
      return;
    }
    map.setPointerCapture(event.pointerId);
    pickMapPoint(event, map);
  });
  map.addEventListener('pointermove', event => {
    if (!mapPicker.hidden && map.hasPointerCapture(event.pointerId)) pickMapPoint(event, map);
    if (pan?.id === event.pointerId) {
      const scale = map.getScreenCTM().a;
      setView(pan.cx - (event.clientX - pan.x) / scale, pan.cy - (event.clientY - pan.y) / scale, width);
    }
  });
  map.addEventListener('lostpointercapture', () => { pan = undefined; });
  const credit = element('figcaption', 'Natural Earth');
  if (onlineTiles) {
    const link = element('a', '© OpenStreetMap contributors');
    link.href = 'https://www.openstreetmap.org/copyright';
    credit.append(' · ', link);
  }
  figure.append(controls, map, credit);
  content.append(figure);
  centerMap();
  const observer = new ResizeObserver(() => {
    if (!map.isConnected) observer.disconnect();
    else setView(cx, cy, width);
  });
  observer.observe(map);
  content.append(selectedPost);
  const unlocated = posts.filter(post => !located.includes(post));
  if (unlocated.length) {
    const section = element('details', undefined, 'map-unlocated');
    section.append(element('summary', 'Sense ubicació (' + unlocated.length + ')'));
    for (const post of unlocated) section.append(card(post, post.place));
    content.append(section);
  }
}

function renderPosts(board) {
  const { posts, mode } = board;
  content.replaceChildren();
  if (mode === 'table') return renderTable(board);
  if (mode === 'map') return renderMap(posts);
  if (!posts.length) {
    if (!presenting) content.append(element('p', 'Afegeix la primera publicació al PAD.', 'empty'));
    return;
  }
  if (mode === 'free') return renderFree(board);
  if (mode === 'timeline') return renderTimeline(board);
  const layout = element('div', undefined, mode);
  if (mode === 'columns' || mode === 'rows') {
    const lanes = new Map();
    for (const post of posts) {
      const name = post.group || 'General';
      if (!lanes.has(name)) {
        const lane = element('section', undefined, 'lane');
        lane.append(element('h2', name));
        layout.append(lane);
        lanes.set(name, lane);
      }
      lanes.get(name).append(card(post));
    }
  } else {
    for (const post of posts) layout.append(card(post, post.group));
  }
  content.append(layout);
}

function pickMapPoint(event, map) {
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(map.getScreenCTM().inverse());
  byId('pick-lat').value = (Math.atan(Math.sinh(Math.PI * (1 - 2 * point.y / 720))) * 180 / Math.PI).toFixed(5);
  byId('pick-lon').value = Math.max(-180, Math.min(180, (point.x - 360) / 2)).toFixed(5);
  updateMapPoint();
}

function updateMapPoint() {
  const lat = byId('pick-lat');
  const lon = byId('pick-lon');
  mapPoint = lat.value && lon.value && lat.validity.valid && lon.validity.valid
    ? { lat: Number(lat.value), lon: Number(lon.value) } : null;
  byId('map-continue').disabled = !mapPoint;
  byId('map-prompt').hidden = !mapPoint;
  byId('pick-name-label').hidden = !mapPoint;
  const draft = byId('pad-map')?.lastElementChild;
  if (draft && mapPoint) {
    draft.setAttribute('cx', 360 + mapPoint.lon * 2);
    draft.setAttribute('cy', mapLatitudeY(mapPoint.lat));
  }
  draft?.toggleAttribute('hidden', !mapPoint);
}

function showMapPicker(show, point = mapSelection) {
  mapPicker.hidden = !show;
  form.querySelector('.editor-fields').hidden = show;
  byId('editor-save').hidden = show;
  byId('post-delete').hidden = show || !editingPost;
  byId('editor-title').textContent = show ? 'Tria una ubicació' : editingPost ? 'Edita la targeta' : 'Nova targeta';
  if (show) {
    byId('pick-lat').value = point?.lat ?? '';
    byId('pick-lon').value = point?.lon ?? '';
    byId('pick-name').value = point?.place ?? '';
    updateMapPoint();
    byId('pick-lat').focus();
  } else {
    form.elements.namedItem('title').focus();
  }
}

function confirmMapLocation(point) {
  if (mapPicker.hidden) return;
  const place = point ? byId('pick-name').value.trim() || point.lat + '°, ' + point.lon + '°' : '';
  mapSelection = point ? { ...point, place } : null;
  for (const [name, value] of Object.entries({ place, lat: point?.lat ?? '', lon: point?.lon ?? '' })) {
    form.elements.namedItem(name).value = value;
  }
  const title = form.elements.namedItem('title');
  if (!title.value.trim()) title.value = place;
  if (!point) {
    byId('pick-lat').value = '';
    updateMapPoint();
  }
  showMapPicker(false);
}

function renderTimeline(board) {
  const dated = board.posts.filter(post => post.date).sort((a, b) => a.date.localeCompare(b.date));
  const undated = board.posts.filter(post => !post.date);
  if (dated.length) {
    const horizontal = board.timelineDirection === 'horizontal';
    const wrap = element('div', undefined, 'timeline-wrap');
    const axis = element('ol', undefined, horizontal ? 'timeline horizontal' : 'timeline vertical');
    if (horizontal) {
      wrap.tabIndex = 0;
      wrap.setAttribute('role', 'region');
      wrap.setAttribute('aria-label', 'Cronologia horitzontal');
    }
    for (const post of dated) {
      const entry = element('li');
      const date = element('time', displayDate(post.date));
      date.dateTime = post.date;
      entry.append(date, card(post));
      axis.append(entry);
    }
    wrap.append(axis);
    content.append(wrap);
  }
  if (undated.length) {
    const section = element('section', undefined, 'lane timeline-undated');
    section.append(element('h2', 'Publicacions sense data'));
    for (const post of undated) section.append(card(post));
    content.append(section);
  }
}

function renderFree(board) {
  const wrap = element('div', undefined, 'free-wrap');
  const layout = element('div', undefined, 'free');
  wrap.append(layout);
  content.append(wrap);

  const cards = board.posts.map(post => {
    const node = card(post, post.group);
    const handle = element('button', '✥ Mou', 'move-handle');
    handle.hidden = presenting;
    handle.type = 'button';
    handle.setAttribute('aria-label', 'Mou «' + post.title + '»');
    node.prepend(handle);
    layout.append(node);
    return { node, handle, post };
  });

  const stride = Math.max(...cards.map(({ node }) => node.offsetHeight)) + 16;
  const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const positioned = cards.map(({ post }, index) => {
    const saved = post.position;
    if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) return saved;
    return {
      x: 16 + (saved?.column ?? index % 3) * 232,
      y: 16 + (saved?.row ?? Math.floor(index / 3)) * stride
    };
  });
  layout.style.minHeight = Math.max(440, ...cards.map(({ node }, index) =>
    positioned[index].y + node.offsetHeight + 96)) + 'px';

  cards.forEach(({ node, handle, post }, index) => {
    const original = positioned[index];
    let drag;
    function place({ x, y }) {
      node.style.left = x + 'px';
      node.style.setProperty('--card-left', x + 'px');
      node.style.top = y + 'px';
    }
    function bounded(x, y) {
      return {
        x: Math.round(Math.max(0, Math.min(x, layout.clientWidth - node.offsetWidth))),
        y: Math.round(Math.max(0, Math.min(y, layout.clientHeight - node.offsetHeight)))
      };
    }
    async function save(position, restoreFocus = false) {
      const pad = activeBoard();
      const posts = pad.posts.map(item => item.id === post.id ? { ...item, position } : item);
      const next = boards.map(item => item.id === pad.id ? { ...pad, posts } : item);
      const scrollLeft = wrap.scrollLeft;
      if (!await persist(next, board.id, status)) {
        place(original);
        return;
      }
      content.querySelector('.free-wrap').scrollLeft = scrollLeft;
      if (restoreFocus) content.querySelectorAll('.move-handle')[index].focus({ preventScroll: true });
    }

    place(original);
    if (presenting) return;
    handle.addEventListener('pointerdown', event => {
      if (saving || drag || event.button !== 0 || !event.isPrimary) return;
      event.preventDefault();
      handle.focus({ preventScroll: true });
      handle.setPointerCapture(event.pointerId);
      const rect = node.getBoundingClientRect();
      drag = { id: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
      node.classList.add('dragging');
    });
    handle.addEventListener('pointermove', event => {
      if (drag?.id !== event.pointerId) return;
      const rect = layout.getBoundingClientRect();
      drag.position = bounded(event.clientX - rect.left - drag.offsetX, event.clientY - rect.top - drag.offsetY);
      place(drag.position);
    });
    handle.addEventListener('pointerup', event => {
      if (drag?.id !== event.pointerId) return;
      const position = drag.position;
      drag = null;
      node.classList.remove('dragging');
      if (position) void save(position, true);
    });
    handle.addEventListener('lostpointercapture', () => {
      if (!drag) return;
      drag = null;
      node.classList.remove('dragging');
      place(original);
    });
    handle.addEventListener('keydown', event => {
      if (!Object.hasOwn(directions, event.key)) return;
      event.preventDefault();
      if (saving || drag) return;
      const [dx, dy] = directions[event.key];
      void save(bounded(original.x + dx * 24, original.y + dy * 24), true);
    });
  });
}

function activeBoard() {
  return boards.find(board => board.id === activeId);
}

function render() {
  const board = activeBoard();
  picker.replaceChildren(...boards.map(item => {
    const option = element('option', item.title);
    option.value = item.id;
    return option;
  }));
  picker.value = activeId;
  picker.disabled = !board;
  byId('save-pad').disabled = !board;
  byId('photo-pad').disabled = !board;
  deleteButton.hidden = !board || presenting;
  byId('new-board').hidden = presenting;
  byId('open-pad').hidden = presenting;
  byId('new-post').hidden = presenting;
  byId('edit-pad').hidden = presenting;
  byId('presentation-title').hidden = !presenting;
  byId('board-surface').hidden = !board;
  byId('board-surface').classList.toggle('map-surface', board?.mode === 'map');
  byId('new-post').textContent = board?.type === 'table' ? '+ Nova fila' : '+ Publica';
  byId('no-pads').hidden = Boolean(board);
  byId('no-pads').textContent = presenting ? 'Encara no tens cap PAD.'
    : 'Encara no tens cap PAD. Prem «Nou PAD» per crear-ne un.';
  byId('timeline-control').hidden = presenting || board?.mode !== 'timeline';
  views.parentElement.hidden = presenting || board?.type !== 'wall';
  if (!board) return;
  timelineDirection.value = board.timelineDirection === 'horizontal' ? 'horizontal' : 'vertical';
  byId('board-surface').dataset.theme = board.theme || 'forest';
  byId('title').textContent = board.title;
  byId('presentation-title').textContent = board.title;
  byId('description').textContent = board.description;
  views.replaceChildren(...Object.entries(wallFormats).map(([mode, label]) => {
    const option = element('option', label);
    option.value = mode;
    return option;
  }));
  views.value = board.mode;
  renderPosts(board);
}

async function persist(next, selectedId, feedback, refresh = true) {
  if (presenting) return false;
  saving = true;
  try {
    await store.save(next);
    boards = next;
    activeId = selectedId;
    status.textContent = '';
    if (refresh) render();
    return true;
  } catch {
    feedback.textContent = 'No s’han pogut desar els canvis. Revisa l’espai i els permisos d’emmagatzematge del navegador.';
    return false;
  } finally {
    saving = false;
  }
}

function openEditor(board, post, pad) {
  if (!boards || saving || dialog.open || presenting) return;
  creatingBoard = board;
  editingPad = pad;
  editingPost = post;
  byId('post-delete').hidden = !post;
  byId('delete-post').hidden = false;
  byId('confirm-post-delete').hidden = true;
  imageRequest++;
  byId('editor-save').disabled = false;
  form.reset();
  for (const name of ['title', 'body', 'group', 'place', 'lat', 'lon', 'link']) {
    form.elements.namedItem(name).value = post?.[name] ?? '';
  }
  if (pad) {
    form.elements.namedItem('title').value = pad.title;
    form.elements.namedItem('body').value = pad.description;
    form.elements.namedItem('theme').value = pad.theme || 'forest';
    if (!form.elements.namedItem('theme').value) form.elements.namedItem('theme').value = 'forest';
  }
  const date = post?.date || '';
  datePrecision.value = { 4: 'year', 7: 'month', 10: 'day' }[date.length] || '';
  form.elements.namedItem('dateYear').value = date ? Number(date.slice(0, 4)) : '';
  form.elements.namedItem('dateMonth').value = date.slice(5, 7);
  form.elements.namedItem('date').value = date.length === 10 ? date : '';
  setEditorImage(post?.image);
  byId('backgrounds').hidden = !board;
  byId('board-types').hidden = !board || Boolean(pad);
  editorStatus.textContent = '';
  const table = !board && activeBoard().type === 'table';
  datePrecision.closest('fieldset').dataset.optional = String(table);
  byId('editor-title').textContent = pad ? 'Edita el PAD' : board ? 'Nou PAD'
    : table ? (post ? 'Edita la fila' : 'Nova fila') : (post ? 'Edita la publicació' : 'Nova publicació');
  const tableColumns = table ? activeBoard().tableColumns ?? defaultTableColumns : [];
  const textDateColumn = tableColumns.find(column => column.id === 'date' && column.label !== 'Data');
  byId('post-title-label').textContent = tableColumns.find(column => column.id === 'title')?.label ?? 'Títol';
  byId('body-label').firstElementChild.textContent = board ? 'Descripció'
    : tableColumns.find(column => column.id === 'body')?.label ?? 'Text';
  const tableFields = byId('table-fields');
  for (const [id, field] of Object.entries(tableFieldControls)) tableFieldAnchors[id].after(field);
  tableFields.replaceChildren();
  for (const column of tableColumns) {
    if (column === textDateColumn) {
      const label = element('label', column.label);
      const input = element('textarea');
      input.name = 'tableDateText';
      input.rows = 2;
      input.maxLength = 500;
      input.value = post?.tableDateText ?? (post?.date ? displayDate(post.date) : '');
      label.append(input);
      tableFields.append(label);
      continue;
    }
    if (Object.hasOwn(tableFieldControls, column.id)) {
      const field = tableFieldControls[column.id];
      if (column.id === 'date' || column.id === 'place') field.firstElementChild.textContent = column.label;
      tableFields.append(field);
      continue;
    }
    const label = element('label', column.label);
    const input = element('input');
    input.name = column.id;
    input.maxLength = 500;
    input.value = post?.tableValues?.[column.id] ?? '';
    label.append(input);
    tableFields.append(label);
  }
  tableFields.hidden = !tableFields.childElementCount;
  const mode = board ? undefined : activeBoard().mode;
  byId('change-location').hidden = mode !== 'map';
  if (!table) {
    tableFieldControls.date.firstElementChild.textContent = 'Data';
    byId('post-place-label').textContent = 'Lloc';
  }
  const visibleFields = board ? [] : ['group', 'link', 'image',
    ...(table ? (textDateColumn ? ['place'] : ['date', 'place']) : postFieldsByMode[mode] || [])];
  byId('post-group-label').textContent = tableColumns.find(column => column.id === 'group')?.label
    ?? (mode === 'rows' || mode === 'columns' ? 'Etiqueta del grup' : 'Etiqueta');
  const groups = board ? [] : activeBoard().posts.map(item => item.group).filter(Boolean);
  byId('post-groups').replaceChildren(...[...new Set(groups)].map(group => {
    const option = element('option');
    option.value = group;
    return option;
  }));
  for (const field of form.querySelectorAll('[data-field]')) {
    field.hidden = !visibleFields.includes(field.dataset.field);
    for (const input of field.querySelectorAll('input, select')) input.disabled = field.hidden;
  }
  updateDateFields();
  byId('editor-save').textContent = pad || post ? 'Desa els canvis' : board ? 'Crea el PAD' : table ? 'Afegeix la fila' : 'Publica';
  if (board) {
    document.body.classList.add('creating-pad');
    document.querySelector('.top').inert = true;
    document.querySelector('main').inert = true;
    dialog.show();
    previewNewPad();
  } else if (mode === 'map') {
    mapSelection = post?.lat != null && post?.lon != null ? { lat: post.lat, lon: post.lon, place: post.place } : null;
    document.body.classList.add('editing-map');
    document.querySelector('.top').inert = true;
    byId('new-post').hidden = true;
    dialog.show();
    showMapPicker(!post);
    return;
  } else {
    dialog.showModal();
  }
  form.elements.namedItem('title').focus();
}

function updateDateFields() {
  const precision = datePrecision.disabled ? '' : datePrecision.value;
  const optional = tableFieldControls.date.dataset.optional === 'true';
  for (const [part, visible] of [
    ['year', precision === 'year' || precision === 'month'],
    ['month', precision === 'month'],
    ['day', precision === 'day']
  ]) {
    const field = byId('date-' + part + '-field');
    field.hidden = !visible;
    field.firstElementChild.disabled = !visible;
    field.firstElementChild.required = visible && !optional;
  }
}

function setEditorImage(image) {
  currentImage = validPostImage(image) ? image : undefined;
  const preview = byId('image-preview');
  if (currentImage) preview.src = currentImage;
  else preview.removeAttribute('src');
  preview.hidden = !currentImage;
  byId('remove-image').hidden = !currentImage;
}

function previewNewPad() {
  if (!dialog.open || !creatingBoard) return;
  const fields = form.elements;
  const type = editingPad?.type ?? fields.namedItem('type').value;
  byId('backgrounds').hidden = type === 'map';
  byId('board-surface').hidden = false;
  byId('board-surface').classList.remove('map-surface');
  byId('no-pads').hidden = true;
  byId('title').textContent = fields.namedItem('title').value.trim() || editingPad?.title || 'Nou PAD';
  byId('description').textContent = fields.namedItem('body').value.trim();
  byId('board-surface').dataset.theme = fields.namedItem('theme').value;
}

async function init() {
  try {
    store = localStore(window.localStorage);
    boards = await store.list();
  } catch {
    status.textContent = 'No es poden llegir els PADS locals. Revisa la configuració d’emmagatzematge del navegador.';
    for (const id of ['boards', 'new-board', 'new-post', 'views']) byId(id).disabled = true;
    return;
  }
  activeId = boards[0]?.id;
  padMode.checked = true;
  padMode.addEventListener('change', () => {
    if (saving) {
      padMode.checked = !presenting;
      return;
    }
    presenting = !padMode.checked;
    render();
  });
  const monthNames = new Intl.DateTimeFormat('ca', { month: 'long', timeZone: 'UTC' });
  const months = form.elements.namedItem('dateMonth');
  for (let month = 1; month <= 12; month++) {
    const option = element('option', monthNames.format(new Date(Date.UTC(2020, month - 1, 1))));
    option.value = String(month).padStart(2, '0');
    months.append(option);
  }
  datePrecision.addEventListener('change', updateDateFields);
  const fileInput = byId('pad-file');
  const openButton = byId('open-pad');
  openButton.disabled = false;
  openButton.addEventListener('click', () => fileInput.click());
  byId('save-pad').addEventListener('click', () => {
    const pad = activeBoard();
    downloadPadFile(new Blob([JSON.stringify({ format: 'THOSPAD', version: 1, pad }, null, 2)],
      { type: 'application/json' }), pad.title, 'thospad.json');
  });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file || saving) return;
    try {
      const pad = readPadFile(await file.text());
      if (saving) return;
      pad.id = makePadId();
      if (await persist([...boards, pad], pad.id, status)) status.textContent = 'PAD obert.';
    } catch {
      status.textContent = 'No s’ha pogut obrir el fitxer. Tria un fitxer desat amb THOSPAD.';
    }
  });
  byId('photo-pad').addEventListener('click', async () => {
    const pad = activeBoard();
    try {
      const image = await padPhoto(byId('board-surface'));
      downloadPadFile(image, pad.title, 'png');
    } catch {
      status.textContent = 'No s’ha pogut exportar la foto del PAD.';
    }
  });
  for (const [mode, label] of Object.entries(modes)) {
    const choice = element('label', undefined, 'type-option');
    const radio = element('input');
    radio.type = 'radio';
    radio.name = 'type';
    radio.value = mode;
    radio.defaultChecked = mode === 'wall';
    const preview = element('span', label);
    preview.dataset.preview = mode;
    choice.append(radio, preview);
    byId('board-types').querySelector('.type-options').append(choice);
  }
  views.addEventListener('change', async () => {
    const board = activeBoard();
    const mode = views.value;
    if (saving || board.type !== 'wall' || !Object.hasOwn(wallFormats, mode)) {
      views.value = board.mode;
      return;
    }
    const next = boards.map(item => item.id === board.id ? { ...item, mode } : item);
    if (!await persist(next, board.id, status)) views.value = board.mode;
  });
  picker.addEventListener('change', () => {
    activeId = picker.value;
    render();
  });
  timelineDirection.addEventListener('change', async () => {
    const board = activeBoard();
    if (!board || board.mode !== 'timeline') return;
    const previous = board.timelineDirection === 'horizontal' ? 'horizontal' : 'vertical';
    if (saving) {
      timelineDirection.value = previous;
      return;
    }
    const direction = timelineDirection.value;
    const next = boards.map(item => item.id === board.id ? { ...item, timelineDirection: direction } : item);
    if (!await persist(next, board.id, status)) timelineDirection.value = previous;
  });
  byId('new-board').addEventListener('click', () => openEditor(true));
  byId('edit-pad').addEventListener('click', () => openEditor(true, undefined, activeBoard()));
  deleteButton.addEventListener('click', () => {
    if (saving) return;
    const pad = activeBoard();
    pendingDeleteId = pad.id;
    byId('delete-description').textContent = 'Vols eliminar «' + pad.title + '» i totes les seves publicacions? Aquesta acció és irreversible.';
    deleteStatus.textContent = '';
    deleteDialog.showModal();
  });
  byId('cancel-delete').addEventListener('click', () => deleteDialog.close());
  byId('delete-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    const index = boards.findIndex(pad => pad.id === pendingDeleteId);
    const next = boards.filter(pad => pad.id !== pendingDeleteId);
    const selected = next[Math.min(index, next.length - 1)]?.id;
    if (await persist(next, selected, deleteStatus)) {
      deleteDialog.close();
      status.textContent = 'PAD eliminat.';
      (next.length ? picker : byId('new-board')).focus();
    }
  });
  byId('new-post').addEventListener('click', () => openEditor(false));
  for (const id of ['pick-lat', 'pick-lon']) byId(id).addEventListener('input', updateMapPoint);
  byId('map-continue').addEventListener('click', () => confirmMapLocation(mapPoint));
  byId('map-skip').addEventListener('click', () => confirmMapLocation(null));
  byId('change-location').addEventListener('click', () => showMapPicker(true));
  byId('cancel').addEventListener('click', () => dialog.close());
  byId('delete-post').addEventListener('click', () => {
    if (saving || !editingPost) return;
    byId('delete-post-title').textContent = editingPost.title;
    byId('confirm-post-delete').hidden = false;
    byId('delete-post').hidden = true;
    byId('cancel-post-delete').focus();
  });
  byId('cancel-post-delete').addEventListener('click', () => {
    byId('confirm-post-delete').hidden = true;
    byId('delete-post').hidden = false;
    byId('delete-post').focus();
  });
  byId('confirm-delete-post').addEventListener('click', async () => {
    if (saving || !editingPost) return;
    const pad = activeBoard();
    const posts = pad.posts.filter(post => post.id !== editingPost.id);
    const next = boards.map(item => item.id === pad.id ? { ...pad, posts } : item);
    if (await persist(next, pad.id, editorStatus)) {
      dialog.close();
      status.textContent = 'Targeta suprimida.';
      byId('new-post').focus();
    } else {
      editorStatus.scrollIntoView({ block: 'nearest' });
    }
  });
  form.addEventListener('input', previewNewPad);
  const imageInput = byId('post-image');
  imageInput.addEventListener('change', async () => {
    const file = imageInput.files[0];
    imageInput.value = '';
    if (!file) return;
    const request = ++imageRequest;
    editorStatus.textContent = '';
    const saveButton = byId('editor-save');
    saveButton.disabled = true;
    try {
      const image = await preparePostImage(file);
      if (dialog.open && request === imageRequest) setEditorImage(image);
    } catch (error) {
      if (dialog.open && request === imageRequest) editorStatus.textContent = error.message;
    } finally {
      if (request === imageRequest) saveButton.disabled = false;
    }
  });
  byId('remove-image').addEventListener('click', () => setEditorImage());
  dialog.addEventListener('keydown', event => {
    if ((creatingBoard || document.body.classList.contains('editing-map')) && event.key === 'Escape') dialog.close();
  });
  dialog.addEventListener('close', () => {
    if (document.body.classList.contains('editing-map')) {
      document.body.classList.remove('editing-map');
      document.querySelector('.top').inert = false;
      mapPicker.hidden = true;
      form.querySelector('.editor-fields').hidden = false;
      byId('editor-save').hidden = false;
      byId('pad-map')?.lastElementChild?.setAttribute('hidden', '');
      byId('new-post').hidden = presenting;
      byId('new-post').focus();
    }
    if (!creatingBoard) return;
    document.body.classList.remove('creating-pad');
    document.querySelector('.top').inert = false;
    document.querySelector('main').inert = false;
    render();
    byId(editingPad ? 'edit-pad' : 'new-board').focus();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving || byId('editor-save').disabled || !mapPicker.hidden) return;
    const fields = Object.fromEntries([...new FormData(form)].map(([name, value]) => [name, value.trim()]));
    if (!fields.title) {
      editorStatus.textContent = 'Escriu un títol.';
      return;
    }
    let next;
    let selected = activeId;
    const id = makePadId();
    if (editingPad) {
      selected = editingPad.id;
      next = boards.map(pad => pad.id === selected ? {
        ...pad, title: fields.title, description: fields.body, theme: fields.theme
      } : pad);
    } else if (creatingBoard) {
      selected = id;
      next = [...boards, { id, title: fields.title, description: fields.body, theme: fields.theme, type: fields.type, mode: fields.type, posts: [] }];
    } else {
      let post;
      try {
        const year = String(Number(fields.dateYear)).padStart(4, '0');
        const dateValue = {
          '': '',
          year: fields.dateYear ? year : '',
          month: fields.dateYear && fields.dateMonth ? year + '-' + fields.dateMonth : '',
          day: fields.date
        }[fields.datePrecision];
        if (fields.datePrecision === 'month' && Boolean(fields.dateYear) !== Boolean(fields.dateMonth)) {
          throw new Error('Completa el mes i l’any o tria «Sense data».');
        }
        fields.date = fields.datePrecision === undefined ? editingPost?.date ?? '' : dateValue ?? '';
        for (const name of ['group', 'place', 'lat', 'lon']) {
          fields[name] ??= String(editingPost?.[name] ?? '');
        }
        const link = webLink(fields.link);
        if (fields.link && !link) throw new Error('Introdueix un enllaç web amb http:// o https://.');
        post = { ...editingPost, id: editingPost?.id ?? id, ...postFrom(fields), link, image: currentImage };
        if (fields.tableDateText !== undefined) post.tableDateText = fields.tableDateText;
        const tableValues = Object.entries(fields).filter(([name]) => name.startsWith('extra-'));
        if (tableValues.length) post.tableValues = Object.fromEntries(tableValues);
      } catch (error) {
        editorStatus.textContent = error.message;
        return;
      }
      next = boards.map(board => {
        if (board.id !== activeId) return board;
        const posts = editingPost ? board.posts.map(item => item.id === post.id ? post : item) : [...board.posts, post];
        return { ...board, posts };
      });
    }
    const newRow = !creatingBoard && !editingPost && activeBoard().type === 'table';
    if (await persist(next, selected, editorStatus)) {
      dialog.close();
      if (newRow) {
        const row = content.querySelector('tr[data-post-id="' + id + '"]');
        row.classList.add('new-table-row');
        row.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }
  });
  render();
}

void init();
