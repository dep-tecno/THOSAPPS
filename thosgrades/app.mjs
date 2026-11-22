import { readWorkbook } from './xlsx.mjs';
import { assignSubject, gradeLabel, hasUnnamedOptative, headers, importAct, metrics,
  optativeMappings, optionalSubjects, states, summarize, totals } from './grades.mjs';

const root = document.querySelector('#main');
const actions = document.querySelector('#session-actions');
const privacy = document.querySelector('#privacy');
const format = new Intl.NumberFormat('ca', { maximumFractionDigits: 2 });
const num = value => value == null ? '—' : format.format(value);
const ratio = (a, b) => b ? `${a} de ${b} (${num(100 * a / b)} %)` : '—';
const ui = { view: 'upload', tab: 'Acta', hidden: false, index: 0, band: null, query: '', subject: '',
  incidents: false, sort: 'acta', type: '', scroll: [0, 0], context: {} };
let session;
let mappingDraft = new Map();
let importSequence = 0;

function e(tag, attrs = {}, ...content) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (name.startsWith('on')) node.addEventListener(name.slice(2), value);
    else if (value !== undefined) node.setAttribute(name, value);
  }
  node.append(...content.flat().filter(part => part != null));
  return node;
}
const button = (label, click, attrs = {}) => e('button', { type: 'button', onclick: click, ...attrs }, label);
const hint = text => e('p', { class: 'muted' }, text);
const panel = (...parts) => e('section', { class: 'panel' }, ...parts);
function field(label, control) { return e('label', {}, label, control); }
function select(options, value, update) {
  const control = e('select', { onchange: event => update(event.target.value) },
    options.map(([key, label]) => e('option', { value: key }, label)));
  control.value = value;
  return control;
}
function stat(label, value, click, pressed) {
  const children = [e('strong', {}, String(value)), e('span', {}, label)];
  return click ? button(children, click, { class: 'stat', 'aria-pressed': String(pressed) }) :
    e('div', { class: 'stat' }, children);
}
function table(labels, rows, act = false) {
  return e('div', { class: 'table-wrap', tabindex: '0', role: 'region', 'aria-label': act ? 'Acta interactiva' : 'Taula de resultats' },
    e('table', { class: act ? 'act' : '' },
      e('thead', {}, e('tr', {}, labels.map((label, i) => e('th', {
        scope: 'col', class: act && i === 0 ? 'sticky' : undefined,
      }, label)))),
      e('tbody', {}, rows.map(row => e('tr', {}, row.map((value, i) => e('td', {
        class: act && i === 0 ? 'sticky' : undefined,
      }, value)))))));
}

function nameOf(student, index) { return ui.hidden ? `Alumne ${index + 1}` : student.name; }
const slotLabel = grade => grade.slot ? `Optativa de la franja ${grade.slot}` : headers[grade.column];
const subjectLabel = grade => grade.subject || (grade.subjectCode ? `${slotLabel(grade)} · ${grade.subjectCode}` : slotLabel(grade));
function badge(grade) {
  const kind = grade.state === 'review' ? 'review' :
    grade.state === 'number' ? (grade.value < 5 ? 'fail' : 'ok') : 'muted';
  return e('span', { class: kind }, gradeLabel(grade));
}
const allGrades = () => session.students.flatMap(student => student.grades);
function render(focus = false) {
  actions.hidden = !session;
  privacy.setAttribute('aria-pressed', String(ui.hidden));
  privacy.textContent = ui.hidden ? 'Mostra les dades personals' : 'Oculta les dades personals';
  const views = { upload, review, summary, studentView };
  root.replaceChildren(views[ui.view]());
  if (focus) root.focus();
}
function openView(view) { ui.view = view; render(true); }
function reset() {
  importSequence++;
  session = undefined;
  mappingDraft = new Map();
  Object.assign(ui, { view: 'upload', tab: 'Acta', hidden: false, index: 0, band: null, query: '',
    subject: '', incidents: false, sort: 'acta', type: '', scroll: [0, 0], context: {} });
  render(true);
}

function upload() {
  const status = e('p', { role: 'status', class: 'muted' });
  const input = e('input', { type: 'file', accept: '.xlsx', onchange: async event => {
    const file = event.target.files[0];
    if (!file) return;
    const current = ++importSequence;
    input.disabled = true;
    status.textContent = 'Llegint l’acta…';
    try {
      if (!/\.xlsx$/i.test(file.name) || file.size > 12 * 1024 * 1024) throw Error('Tria un fitxer XLSX de fins a 12 MB.');
      const data = importAct(await readWorkbook(await file.arrayBuffer()));
      if (current !== importSequence) return;
      session = data;
      openView('review');
    } catch (error) {
      if (current !== importSequence) return;
      status.className = 'notice';
      status.textContent = error instanceof Error && /^(El |La |No |Hi |Tria |Compressió)/.test(error.message) ?
        error.message : 'No s’ha pogut llegir l’Excel. Comprova el format del fitxer.';
      input.value = '';
      input.disabled = false;
    }
  } });
  return e('section', { class: 'intro' },
    e('h1', {}, 'Junta d’avaluació'),
    hint('Carrega l’Excel que has extret de l’acta de 1r de batxillerat amb THOSSCAN.'),
    panel(e('div', { class: 'upload' }, field('Acta en format XLSX', input), status)),
    hint('El fitxer es llegeix al dispositiu. Les dades s’esborren de l’aplicació quan finalitzes la sessió o recarregues la pàgina.'));
}

function contextFields() {
  const inputs = [['year', 'Curs acadèmic', '2025–26'], ['group', 'Grup', '1r A'],
    ['period', 'Avaluació', '1a avaluació'], ['date', 'Data de la sessió', '']];
  return e('div', { class: 'fields' }, inputs.map(([key, title, placeholder]) => {
    const input = e('input', { type: key === 'date' ? 'date' : 'text', maxlength: '80',
      placeholder, oninput: event => { ui.context[key] = event.target.value.trim(); } });
    input.value = ui.context[key] ?? '';
    return field(title, input);
  }));
}

function review() {
  const { students, rejected } = session;
  const grades = allGrades();
  const unnamed = grades.filter(hasUnnamedOptative);
  const unnamedBands = unnamed.filter(grade => !grade.subjectCode).length;
  const mappings = optativeMappings(students);
  const names = [...new Set([...Object.values(optionalSubjects),
    ...grades.map(grade => grade.subject).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'ca'));
  const issues = grades.filter(grade => grade.state === 'review');
  const missing = grades.filter(grade => grade.state === 'missing');
  const content = [
    e('h1', {}, 'Revisa la importació'),
    e('div', { class: 'stats' },
      stat('Alumnes llegits', students.length), stat('Notes numèriques', metrics(grades).n),
      stat('Optatives sense nom', unnamed.length), stat('Notes per revisar', issues.length),
      stat('Caselles sense nota', missing.length), stat('Registres exclosos', rejected.length)),
    panel(e('h2', {}, 'Dades de l’acta'),
      hint('Omple els camps que vulguis mostrar a la junta. Els Excel de mostra contenen la taula de notes.'),
      contextFields()),
  ];
  if (unnamedBands || mappings.length) {
    content.push(panel(e('h2', {}, 'Revisa les optatives'),
      unnamedBands ? hint(`${unnamedBands} qualificacions sense codi de matèria es mostraran per franja.`) : null,
      mappings.length ? hint('Tria o escriu un nom per a cada codi que coneguis. Els codis que deixis en blanc es mostraran amb la franja.') : null,
      mappings.length ? e('datalist', { id: 'subject-catalogue' }, names.map(value => e('option', { value }))) : null,
      mappings.length ? table(['Optativa sense nom', 'Nom de la matèria'], mappings.map(mapping => {
        const modality = modalityLabel(mapping.modality);
        const label = [mapping.code, modality].filter(Boolean).join(' · ');
        const input = e('input', { class: 'mapping-name', list: 'subject-catalogue', maxlength: '120',
          'aria-label': `Nom de la matèria ${label}`, placeholder: 'Tria o escriu el nom',
          oninput: event => mappingDraft.set(mapping.key, event.target.value) });
        input.value = mappingDraft.get(mapping.key) ?? mapping.grades[0].subject;
        return [e('div', {}, e('strong', {}, label), ' ', e('small', {}, `(${mapping.grades.length} registres)`)), input];
      })) : null));
  }
  content.push(button('Continua al resum', () => {
    for (const mapping of mappings) {
      if (!mappingDraft.has(mapping.key)) continue;
      const value = mappingDraft.get(mapping.key).trim();
      const known = names.find(name => name.toLocaleLowerCase('ca') === value.toLocaleLowerCase('ca'));
      assignSubject(mapping.grades, known ?? value);
    }
    mappingDraft.clear();
    openView('summary');
  }, { class: 'primary' }));
  if (issues.length || rejected.length) {
    content.push(panel(e('h2', {}, 'Incidències'),
      hint('Les notes pendents queden fora dels càlculs. Les referències indiquen on cal contrastar-les amb l’acta.'),
      table(['Origen', 'Incidència', 'Contingut'], [
        ...issues.map(grade => [grade.source, 'Nota pendent de revisió', ui.hidden ? '—' : grade.raw.replace(/\n/g, ' / ')]),
        ...rejected.map(item => [item.source, item.reason, '—']),
      ])));
  }
  return e('section', {}, content);
}

function modalityLabel(code) {
  return ({ 2000: 'Científic i Tecnològic', 3000: 'Humanístic i Social' })[code] ?? code;
}

function groupContext(students) {
  const mode = new Set(students.map(student => student.modality));
  const date = ui.context.date;
  const parts = ['1r de batxillerat', ui.context.year, ui.context.group, ui.context.period,
    date ? new Intl.DateTimeFormat('ca', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(date)) : '',
    mode.size === 1 ? modalityLabel([...mode][0]) : 'Diverses modalitats'];
  return parts.filter(Boolean).join(' · ');
}

function summary() {
  const { students, rejected } = session;
  const report = summarize(students);
  const special = report.grades.filter(grade => grade.state === 'special');
  const unknown = report.grades.filter(hasUnnamedOptative).length;
  const reviewCount = report.grades.filter(grade => grade.state === 'review').length;
  const complete = students.length - report.provisional;
  function switchTab(tab) { ui.tab = tab; render(true); }
  const bodies = { Acta: () => act(students, report), Matèries: () => subjects(report),
    'Distribució de notes': () => distribution(report), Optatives: () => bands(report) };
  return e('section', {},
    e('h1', {}, 'Resum del grup'), hint(groupContext(students)),
    button('Torna a la revisió', () => openView('review')),
    e('div', { class: 'stats' }, stat('Alumnes inclosos', students.length), stat('Notes numèriques', report.n),
      stat('Matèries amb nota', report.subjectRows.filter(group => metrics(group.grades).n).length),
      stat('Notes pendents de revisió', reviewCount), stat('Optatives sense nom', unknown),
      stat('Estats d’avaluació', special.length)),
    special.length ? hint(Object.entries(states).map(([id, title]) => [title, special.filter(g => g.special === id).length])
      .filter(([, count]) => count).map(([title, count]) => `${title}: ${count}`).join(' · ')) : null,
    rejected.length ? e('p', { class: 'notice' }, `${rejected.length} incidències d’importació amb registres o fulls exclosos.`) : null,
    panel(e('h2', {}, 'Matèries no superades per alumne'),
      hint(`Recompte sobre ${complete} de ${students.length} alumnes amb balanç complet segons les caselles llegides. El fitxer pot representar un fragment de l’acta.`),
      e('div', { class: 'stats' }, report.distribution.map((count, i) =>
        stat(`${i === 4 ? '4 o més' : i} no superades`, ratio(count, complete), () => {
          ui.band = ui.band === i ? null : i;
          switchTab('Acta');
        }, ui.band === i)),
      stat('Balanç provisional', report.provisional, () => {
        ui.band = ui.band === 'provisional' ? null : 'provisional';
        switchTab('Acta');
      }, ui.band === 'provisional'))),
    e('nav', { class: 'tabs', 'aria-label': 'Vistes del grup' }, Object.keys(bodies).map(tab =>
      button(tab, () => switchTab(tab), { 'aria-pressed': String(ui.tab === tab) }))),
    bodies[ui.tab]());
}

function act(students, report) {
  const filter = e('input', { type: 'search', placeholder: ui.hidden ? 'Número d’alumne' : 'Nom o número d’acta' });
  filter.value = ui.query;
  const wrap = e('div');
  const matches = e('p', { class: 'muted', role: 'status' });
  function fill() {
    const q = ui.query.toLocaleLowerCase('ca');
    const rows = students.map((student, index) => ({ student, index, total: totals(student) })).filter(({ student, index, total }) =>
      (ui.band === null || (ui.band === 'provisional' ? total.provisional : !total.provisional && total.band === ui.band)) &&
      (!ui.subject || student.grades.some(grade => grade.subject === ui.subject)) &&
      (!ui.incidents || total.provisional) &&
      (!q || `${nameOf(student, index)} ${ui.hidden ? '' : student.ordinal}`.toLocaleLowerCase('ca').includes(q)));
    if (ui.sort === 'fail') rows.sort((a, b) => b.total.count - a.total.count || a.index - b.index);
    matches.textContent = `${rows.length} de ${students.length} alumnes`;
    const grid = table(['Alumne', ...headers.slice(0, 2), ...headers.slice(3), 'No superades'], rows.map(({ student, index, total }) => [
      button(nameOf(student, index), () => {
        const current = wrap.firstElementChild;
        ui.scroll = [current.scrollLeft, current.scrollTop];
        ui.index = index;
        openView('studentView');
      }, { class: 'link' }),
      ui.hidden ? String(index + 1) : student.ordinal,
      ui.hidden ? '—' : student.id,
      student.modality || '—', ui.hidden ? '—' : student.registration || '—',
      ...student.grades.map(grade => [grade.slot || [7, 10, 11, 12, 17].includes(grade.column) ?
        e('small', { class: 'cell-label' }, grade.state === 'empty' ? '' : subjectLabel(grade)) : null, badge(grade)]),
      String(total.count), // provisional status accompanies the count below
    ].map((cell, i, arr) => i === arr.length - 1 && total.provisional ?
      [cell, e('small', {}, 'Provisional')] : cell)), true);
    wrap.replaceChildren(grid);
    grid.scrollTo(...ui.scroll);
  }
  filter.addEventListener('input', () => { ui.query = filter.value.trim(); ui.scroll = [0, 0]; fill(); });
  const update = (key, value) => { ui[key] = value; ui.scroll = [0, 0]; fill(); };
  const activeBand = ui.band === 'provisional' ? 'balanç provisional' : `${ui.band === 4 ? '4 o més' : ui.band} no superades`;
  fill();
  return panel(e('h2', {}, 'Acta interactiva'),
    e('div', { class: 'fields' }, field('Cerca', filter),
      field('Matèria', select([['', 'Totes'], ...report.subjectRows.map(({ name }) => [name, name])], ui.subject, value => update('subject', value))),
      field('Ordre', select([['acta', 'Ordre de l’acta'], ['fail', 'Més matèries no superades']], ui.sort, value => update('sort', value))),
      field('Registres', select([['', 'Tots'], ['pending', 'Amb balanç provisional']], ui.incidents ? 'pending' : '',
        value => update('incidents', Boolean(value))))),
    ui.band === null ? null : button(`Treu el filtre «${activeBand}»`, () => { ui.band = null; render(); }),
    matches, wrap);
}

function subjects(report) {
  const list = report.subjectRows.map(group => {
    const m = metrics(group.grades);
    const title = button(group.name, () => { ui.subject = group.name; ui.tab = 'Acta'; render(true); }, { class: 'link' });
    return [title, String(m.n), String(m.passed), String(m.failed), ratio(m.passed, m.n), num(m.average), num(m.median),
      num(m.min), num(m.max), String(group.grades.filter(grade => grade.state === 'special').length),
      String(group.grades.filter(grade => ['missing', 'review'].includes(grade.state)).length)];
  });
  return panel(e('h2', {}, 'Resultats per matèria'),
    hint('El percentatge d’aprovats es calcula sobre les notes numèriques de cada matèria.'), table([
      'Matèria', 'Notes', 'Aprovats', 'Suspesos', '% aprovats', 'Mitjana', 'Mediana', 'Mínim', 'Màxim', 'Estats', 'Pendents',
    ], list));
}

function distribution(report) {
  const base = e('div');
  function draw() {
    const grades = report.grades.filter(grade => (!ui.type || grade.type === ui.type) && grade.state === 'number');
    const m = metrics(grades);
    const bins = Array.from({ length: 11 }, (_, i) => grades.filter(grade => Math.floor(grade.value) === i).length);
    base.replaceChildren(hint(`${m.n} qualificacions numèriques. La mitjana pondera igual cada qualificació.`),
      e('div', { class: 'stats' }, stat('Mitjana', num(m.average)), stat('Mediana', num(m.median)),
        stat('Mínim', num(m.min)), stat('Màxim', num(m.max)), stat('Desviació estàndard', num(m.deviation))),
      e('ul', { class: 'plot', 'aria-label': 'Nombre de notes per tram' }, bins.map((count, i) => {
        const label = i === 10 ? '10' : `${i} a menys de ${i + 1}`;
        return e('li', {}, e('span', {}, label), e('meter', { value: count, min: 0, max: Math.max(1, ...bins),
          'aria-label': `${label}: ${count} notes` }), e('strong', {}, String(count)));
      })));
  }
  draw();
  return panel(e('h2', {}, 'Distribució de notes'),
    field('Tipus de matèria', select([['', 'Totes'], ['comuna', 'Comunes'], ['modalitat', 'De modalitat'],
      ['optativa', 'Optatives'], ['altres', 'Altres']], ui.type, value => { ui.type = value; draw(); })), base);
}

function bands(report) {
  return panel(e('h2', {}, 'Optatives per franja'),
    hint('Cada nota compta una vegada dins la seva franja. La vista de matèries només inclou les optatives identificades.'),
    table(['Franja', 'Notes numèriques', 'Aprovades', 'No superades', 'Mitjana', 'Amb matèria', 'Amb nota i sense matèria',
      'Estats', 'Sense nota', 'Pendents de revisió'], [1, 2, 3].map(slot => {
      const grades = report.grades.filter(grade => grade.slot === slot);
      const m = metrics(grades);
      const count = predicate => String(grades.filter(predicate).length);
      return [`Optativa de la franja ${slot}`, String(m.n), ratio(m.passed, m.n), String(m.failed), num(m.average),
        count(grade => grade.state === 'number' && grade.subject), count(grade => grade.state === 'number' && !grade.subject),
        count(grade => grade.state === 'special'), count(grade => grade.state === 'missing' || grade.state === 'empty'),
        count(grade => grade.state === 'review')];
    })));
}

function move(delta) {
  const next = ui.index + delta;
  if (next < 0 || next >= session.students.length) return;
  ui.index = next;
  render(true);
}
function studentView() {
  const student = session.students[ui.index];
  const total = totals(student);
  const notes = metrics(student.grades);
  const grades = student.grades.filter(grade => grade.state !== 'empty');
  return e('section', {},
    e('h1', {}, nameOf(student, ui.index)), hint(`Alumne ${ui.index + 1} de ${session.students.length}`),
    e('div', { class: 'bar' },
      button('Torna al grup', () => openView('summary')),
      button('← Anterior', () => move(-1), { disabled: ui.index === 0 ? '' : undefined }),
      button('Següent →', () => move(1), { disabled: ui.index + 1 === session.students.length ? '' : undefined })),
    e('div', { class: 'stats' }, stat('Notes numèriques', notes.n),
      stat(total.provisional ? 'No superades · provisional' : 'No superades', total.count),
      stat('Mitjana de les notes disponibles', num(notes.average)), stat('Mediana', num(notes.median))),
    panel(e('h2', {}, 'Qualificacions'),
      table(['Matèria', 'Franja', 'Nota o estat'], grades.map(grade =>
        [subjectLabel(grade), grade.slot ? String(grade.slot) : '—', badge(grade)]))));
}

privacy.addEventListener('click', () => {
  ui.hidden = !ui.hidden;
  ui.query = '';
  render();
});
document.querySelector('#clear').addEventListener('click', reset);
document.addEventListener('keydown', event => {
  if (ui.view !== 'studentView' || event.altKey || event.ctrlKey || event.metaKey ||
      event.target.closest?.('input, select, textarea, .table-wrap')) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    move(event.key === 'ArrowLeft' ? -1 : 1);
  }
});
window.addEventListener('pagehide', reset);
render();
