
const byId = id => document.getElementById(id);
const picker = byId('boards');
const content = byId('content');
const dialog = byId('editor');
const form = byId('edit-form');
const status = byId('status');
const editorStatus = byId('editor-status');
const views = byId('views');
const timelineDirection = byId('timeline-direction');
const deleteDialog = byId('delete-dialog');
const deleteButton = byId('delete-pad');
const deleteStatus = byId('delete-status');
let pendingDeleteId;
const dateFormat = new Intl.DateTimeFormat('ca', { dateStyle: 'long', timeZone: 'UTC' });
const monthFormat = new Intl.DateTimeFormat('ca', { year: 'numeric', month: 'long', timeZone: 'UTC' });
const datePrecision = byId('date-precision');
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
  const node = element('article');
  if (detail) node.append(element('small', detail));
  if (post.group && post.group !== detail) node.append(element('small', post.group));
  node.append(element('h3', post.title));
  if (post.body) node.append(element('p', post.body));
  addPostAttachments(node, post);
  enablePostEditing(node, node, post);
  return node;
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
  const editable = board.type === 'table';
  const columns = editable ? board.tableColumns ?? defaultTableColumns : defaultTableColumns;
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
    for (const column of columns) {
      const cell = row.insertCell();
      const value = column.id === 'date' ? post.date && displayDate(post.date)
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
  const map = svg('svg', { viewBox: '0 0 720 360', role: 'img', 'aria-label': 'Mapa esquemàtic amb coordenades geogràfiques' });
  const located = posts.filter(post => post.lat !== null && post.lon !== null);
  for (let x = 60; x < 720; x += 60) {
    map.append(svg('path', { d: 'M' + x + ' 0V360', stroke: x === 360 ? '#899db5' : '#45617c' }));
  }
  for (let y = 60; y < 360; y += 60) {
    map.append(svg('path', { d: 'M0 ' + y + 'H720', stroke: y === 180 ? '#899db5' : '#45617c' }));
  }
  const list = element('ol', undefined, 'map-list');
  located.forEach((post, index) => {
    const x = 360 + post.lon * 2;
    const y = 180 - post.lat * 2;
    const pin = svg('circle', { cx: x, cy: y, r: 8, fill: '#00e676', stroke: '#0f1117' });
    const label = svg('text', { x: Math.max(12, Math.min(708, x)), y: Math.max(16, y - 10), fill: '#fff', 'text-anchor': 'middle', 'font-size': 14 });
    label.textContent = index + 1;
    map.append(pin, label);
    const item = element('li');
    item.append(card(post, [post.place, post.lat + '°, ' + post.lon + '°'].filter(Boolean).join(' · ')));
    list.append(item);
  });
  figure.append(map, element('figcaption', 'Mapa esquemàtic de latitud i longitud · Línies cada 30°'));
  content.append(figure);
  if (located.length) content.append(list);
  const unlocated = posts.filter(post => !located.includes(post));
  if (unlocated.length) {
    const section = element('div', undefined, 'lane');
    section.append(element('h2', 'Publicacions sense coordenades'));
    for (const post of unlocated) section.append(card(post, post.place));
    content.append(section);
  }
}

function renderPosts(board) {
  const { posts, mode } = board;
  content.replaceChildren();
  if (mode === 'table') return renderTable(board);
  if (!posts.length) {
    content.append(element('p', 'Afegeix la primera publicació al PAD.', 'empty'));
    return;
  }
  if (mode === 'map') return renderMap(posts);
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
      node.style.top = y + 'px';
    }
    function bounded(x, y) {
      return {
        x: Math.round(Math.max(0, Math.min(x, layout.clientWidth - node.offsetWidth))),
        y: Math.round(Math.max(0, Math.min(y, layout.clientHeight - node.offsetHeight)))
      };
    }
    async function save(position, restoreFocus = false) {
      const posts = board.posts.map(item => item.id === post.id ? { ...item, position } : item);
      const next = boards.map(item => item.id === board.id ? { ...board, posts } : item);
      const scrollLeft = wrap.scrollLeft;
      if (!await persist(next, board.id, status)) {
        place(original);
        return;
      }
      content.querySelector('.free-wrap').scrollLeft = scrollLeft;
      if (restoreFocus) content.querySelectorAll('.move-handle')[index].focus({ preventScroll: true });
    }

    place(original);
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
  deleteButton.hidden = !board;
  byId('board-surface').hidden = !board;
  byId('no-pads').hidden = Boolean(board);
  byId('timeline-control').hidden = board?.mode !== 'timeline';
  if (!board) return;
  timelineDirection.value = board.timelineDirection === 'horizontal' ? 'horizontal' : 'vertical';
  byId('board-surface').dataset.theme = board.theme || 'forest';
  byId('title').textContent = board.title;
  byId('description').textContent = board.description;
  views.parentElement.hidden = board.type !== 'wall';
  views.replaceChildren(...Object.entries(wallFormats).map(([mode, label]) => {
    const option = element('option', label);
    option.value = mode;
    return option;
  }));
  views.value = board.mode;
  renderPosts(board);
}

async function persist(next, selectedId, feedback) {
  saving = true;
  try {
    await store.save(next);
    boards = next;
    activeId = selectedId;
    status.textContent = '';
    render();
    return true;
  } catch {
    feedback.textContent = 'No s’han pogut desar els canvis. Revisa l’espai i els permisos d’emmagatzematge del navegador.';
    return false;
  } finally {
    saving = false;
  }
}

function openEditor(board, post, pad) {
  if (!boards || saving || dialog.open) return;
  creatingBoard = board;
  editingPad = pad;
  editingPost = post;
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
  byId('editor-title').textContent = pad ? 'Edita el PAD' : board ? 'Nou PAD' : post ? 'Edita la publicació' : 'Nova publicació';
  const tableColumns = !board && activeBoard().type === 'table' ? activeBoard().tableColumns ?? defaultTableColumns : [];
  byId('post-title-label').textContent = tableColumns.find(column => column.id === 'title')?.label ?? 'Títol';
  byId('body-label').firstElementChild.textContent = board ? 'Descripció'
    : tableColumns.find(column => column.id === 'body')?.label ?? 'Text';
  const tableFields = byId('table-fields');
  tableFields.replaceChildren();
  for (const column of tableColumns.filter(item => item.id.startsWith('extra-'))) {
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
  const visibleFields = board ? [] : ['group', 'link', 'image', ...(postFieldsByMode[mode] || [])];
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
  byId('editor-save').textContent = pad || post ? 'Desa els canvis' : board ? 'Crea el PAD' : 'Publica';
  if (board) {
    document.body.classList.add('creating-pad');
    document.querySelector('.top').inert = true;
    document.querySelector('main').inert = true;
    dialog.show();
    previewNewPad();
  } else {
    dialog.showModal();
  }
  form.elements.namedItem('title').focus();
}

function updateDateFields() {
  const precision = datePrecision.disabled ? '' : datePrecision.value;
  for (const [part, visible] of [
    ['year', precision === 'year' || precision === 'month'],
    ['month', precision === 'month'],
    ['day', precision === 'day']
  ]) {
    const field = byId('date-' + part + '-field');
    field.hidden = !visible;
    field.firstElementChild.disabled = !visible;
    field.firstElementChild.required = visible;
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
  byId('board-surface').hidden = false;
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
  byId('cancel').addEventListener('click', () => dialog.close());
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
    if (creatingBoard && event.key === 'Escape') dialog.close();
  });
  dialog.addEventListener('close', () => {
    if (!creatingBoard) return;
    document.body.classList.remove('creating-pad');
    document.querySelector('.top').inert = false;
    document.querySelector('main').inert = false;
    render();
    byId(editingPad ? 'edit-pad' : 'new-board').focus();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving || byId('editor-save').disabled) return;
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
        fields.date = {
          '': '',
          year,
          month: year + '-' + fields.dateMonth,
          day: fields.date
        }[fields.datePrecision] ?? editingPost?.date ?? '';
        for (const name of ['group', 'place', 'lat', 'lon']) {
          fields[name] ??= String(editingPost?.[name] ?? '');
        }
        const link = webLink(fields.link);
        if (fields.link && !link) throw new Error('Introdueix un enllaç web amb http:// o https://.');
        post = { ...editingPost, id: editingPost?.id ?? id, ...postFrom(fields), link, image: currentImage };
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
    if (await persist(next, selected, editorStatus)) dialog.close();
  });
  render();
}

void init();
