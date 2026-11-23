import { readWorkbook } from './xlsx.mjs';
import { assignColumn, assignSubject, balanceCategory, balanceLabels, failedBoth, failureConcentration, gradeLabel, hasUnnamedOptative,
  importAct, metrics, optativeMappings, optionalSubjects, states, subjectDistribution, subjectPairs,
  summarize, totals } from './grades.mjs';
import { studentAnalysis } from './student-analysis.mjs';
import { createActa } from './acta-export.mjs';

const root = document.querySelector('#main');
const actions = document.querySelector('#session-actions');
const privacy = document.querySelector('#privacy');
const format = new Intl.NumberFormat('ca', { maximumFractionDigits: 2 });
const num = value => value == null ? '—' : format.format(value);
const ratio = (a, b) => b ? `${a} de ${b} (${num(100 * a / b)} %)` : '—';
const ui = { view: 'upload', tab: 'Acta', hidden: false, index: 0, band: null, query: '', subject: '',
  subjectResult: '', pair: null, detailSubject: '', selectedMatter: '', incidents: false, sort: 'acta', type: '',
  scroll: [0, 0], actPageTop: 0, context: {} };
let session;
let mappingDraft = new Map();
let importSequence = 0;

function currentAcademicYear() {
  const date = new Date();
  const parts = new Intl.DateTimeFormat('ca', { timeZone: 'Europe/Madrid', year: 'numeric', month: 'numeric' })
    .formatToParts(date);
  const year = Number(parts.find(part => part.type === 'year').value);
  const month = Number(parts.find(part => part.type === 'month').value);
  const start = month >= 9 ? year : year - 1;
  return `${start}–${String(start + 1).slice(-2)}`;
}

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
function table(labels, rows, act = false, regionLabel = act ? 'Acta interactiva' : 'Taula de resultats', full = false) {
  return e('div', { class: full ? 'full-subjects' : 'table-wrap', tabindex: full ? undefined : '0',
    role: 'region', 'aria-label': regionLabel },
    e('table', { class: act ? 'act' : '' },
      e('thead', {}, e('tr', {}, labels.map((label, i) => e('th', {
        scope: 'col', class: act && i === 0 ? 'sticky' : undefined,
      }, label)))),
      e('tbody', {}, rows.map(row => e('tr', {}, row.map((value, i) => e('td', {
        class: act && i === 0 ? 'sticky' : undefined,
        'data-label': full ? labels[i] : undefined,
      }, value)))))));
}

function nameOf(student, index) { return ui.hidden ? `Alumne ${index + 1}` : student.name; }
const slotLabel = grade => grade.slot ? `Optativa de la franja ${grade.slot}` : grade.label;
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
  if (focus && ui.view === 'studentView') {
    const heading = root.querySelector('h1');
    heading.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  } else if (focus) root.focus();
}
function openView(view) { ui.view = view; render(true); }
function reset() {
  importSequence++;
  session = undefined;
  mappingDraft = new Map();
  Object.assign(ui, { view: 'upload', tab: 'Acta', hidden: false, index: 0, band: null, query: '',
    subject: '', subjectResult: '', pair: null, detailSubject: '', selectedMatter: '', incidents: false,
    sort: 'acta', type: '', scroll: [0, 0], actPageTop: 0, context: {} });
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
      ui.context = { ...data.context, year: data.context.year || currentAcademicYear() };
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
    panel(e('div', { class: 'upload' }, field('Acta en format XLSX', input), status)),
    hint('El fitxer es llegeix al dispositiu. Les dades s’esborren de l’aplicació quan finalitzes la sessió o recarregues la pàgina.'));
}

function contextFields() {
  const inputs = [['year', 'Curs acadèmic'], ['group', 'Grup', 'Escriu el grup'],
    ['period', 'Avaluació', 'Escriu l’avaluació'], ['date', 'Data de la sessió']];
  return e('div', { class: 'fields act-context' }, inputs.map(([key, title, placeholder]) => {
    const input = e('input', { id: `act-${key}`, type: key === 'date' ? 'date' : 'text', maxlength: '80',
      autocomplete: 'off', placeholder, oninput: event => { ui.context[key] = event.target.value; } });
    input.value = ui.context[key] ?? '';
    return field(title, input);
  }));
}

function review() {
  const { students, rejected, unresolved } = session;
  const grades = allGrades();
  const unnamed = grades.filter(hasUnnamedOptative);
  const unnamedBands = unnamed.filter(grade => !grade.subjectCode).length;
  const mappings = optativeMappings(students);
  const names = [...new Set([...Object.values(optionalSubjects),
    ...grades.map(grade => grade.subject).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'ca'));
  const issues = grades.filter(grade => grade.state === 'review' || grade.subjectReview);
  const missing = grades.filter(grade => grade.state === 'missing');
  const content = [
    e('h1', {}, 'Revisa la importació'),
    e('div', { class: 'stats' },
      stat('Alumnes llegits', students.length), stat('Notes numèriques', metrics(grades).n),
      stat('Optatives sense nom', unnamed.length), stat('Notes per revisar', issues.filter(grade => grade.state === 'review').length),
      stat('Caselles sense nota', missing.length), stat('Registres exclosos', rejected.length)),
    panel(e('h2', {}, 'Dades de l’acta'),
      hint('Pots editar els quatre camps abans de continuar. Si el curs no figura al fitxer, es proposa l’actual.'),
      contextFields()),
  ];
  if (unresolved.length) {
    content.push(panel(e('h2', {}, 'Revisa les columnes'),
      hint('Indica el nom de les columnes de notes que reconeguis. Les caselles amb una lectura dubtosa quedaran pendents.'),
      table(['Capçalera original', 'Nom de la matèria'], unresolved.map(column => {
        const label = `${column.label} · ${column.grades.length} caselles`;
        if (column.duplicate) return [label, 'Capçalera repetida · pendent de revisió'];
        const input = e('input', { class: 'mapping-name', maxlength: '120', 'aria-label': `Matèria de ${column.label}`,
          placeholder: 'Escriu el nom', oninput: event => mappingDraft.set(column.key, event.target.value) });
        input.value = mappingDraft.get(column.key) ?? column.grades[0].subject;
        return [label, input];
      }))));
  }
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
    for (const column of unresolved) {
      if (mappingDraft.has(column.key)) assignColumn(column, mappingDraft.get(column.key));
    }
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
      hint('Les notes pendents queden fora dels càlculs. Si només és dubtosa la matèria, la nota es manté a la franja.'),
      table(['Origen', 'Incidència', 'Contingut'], [
        ...issues.map(grade => [grade.source, grade.subjectReview ? 'Matèria pendent · nota de franja vàlida' :
          'Nota pendent de revisió', ui.hidden ? '—' : grade.raw.replace(/\n/g, ' / ')]),
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
  const parts = [`${session.level === 2 ? '2n' : '1r'} de batxillerat`, ui.context.year?.trim(), ui.context.group?.trim(), ui.context.period?.trim(),
    date ? new Intl.DateTimeFormat('ca', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(date)) : '',
    mode.size === 1 ? modalityLabel([...mode][0]) : 'Diverses modalitats'];
  return parts.filter(Boolean).join(' · ');
}

function openAct(filters = {}) {
  Object.assign(ui, { tab: 'Acta', band: null, query: '', subject: '', subjectResult: '', pair: null,
    incidents: false, sort: 'acta', scroll: [0, 0] }, filters);
  render();
  document.querySelector('#group-act-title').focus();
}

function downloadActa(status) {
  try {
    const modes = [...new Set(session.students.map(student => modalityLabel(student.modality)).filter(Boolean))];
    const level = `${session.level === 2 ? '2n' : '1r'} de batxillerat`;
    const subtitle = [level, modes.length === 1 ? modes[0] : ''].filter(Boolean).join(' · ');
    const file = createActa(session.students, { context: ui.context, subtitle, anonymize: ui.hidden });
    const group = ui.context.group?.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim();
    const url = URL.createObjectURL(file);
    const link = e('a', { href: url, download: `Acta de la junta${group ? ' - ' + group : ''}.docx`, hidden: '' });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    status.textContent = 'Acta preparada per descarregar.';
  } catch {
    status.textContent = 'No s’ha pogut generar el Word. Torna-ho a provar.';
  }
}

function summary() {
  const { students, rejected } = session;
  const report = summarize(students);
  const special = report.grades.filter(grade => grade.state === 'special');
  const unknown = report.grades.filter(hasUnnamedOptative).length;
  const reviewCount = report.grades.filter(grade => grade.state === 'review').length;
  function switchTab(tab) { ui.tab = tab; render(true); }
  const bodies = { Acta: () => act(students, report), Matèries: () => subjects(report),
    'Distribució de notes': () => distribution(report), Optatives: () => bands(report),
    'Anàlisi del grup': () => analysis(students, report) };
  const exportStatus = e('p', { class: 'export-status muted', role: 'status' });
  return e('section', {},
    e('h1', {}, 'Resum del grup'), hint(groupContext(students)),
    button('Torna a la revisió', () => openView('review')),
    e('div', { class: 'stats balance-overview' }, Object.entries(balanceLabels).map(([key, label]) =>
      stat(label, ratio(report.balances[key], students.length),
        () => openAct({ band: ui.band === key ? null : key, sort: key === 'many' ? 'fail' : 'acta' }), ui.band === key))),
    e('details', { class: 'coverage' },
      e('summary', {}, `Cobertura de l’acta · ${students.length} alumnes · ${report.n} notes numèriques`),
      hint(`El fitxer pot representar un fragment de l’acta. ${reviewCount} notes pendents de revisió, ${unknown} optatives sense nom i ${rejected.length} registres o fulls exclosos.`),
      special.length ? hint(Object.entries(states).map(([id, title]) => [title, special.filter(g => g.special === id).length])
        .filter(([, count]) => count).map(([title, count]) => `${title}: ${count}`).join(' · ')) : null),
    e('div', { class: 'group-insights' },
      panel(e('h2', {}, 'Matèries no superades per alumne'),
        hint(`${students.length - report.provisional} de ${students.length} alumnes amb balanç complet segons les caselles llegides.`),
        e('div', { class: 'stats' }, report.distribution.map((count, i) =>
          stat(`${i === 4 ? '4 o més' : i} no superades`, ratio(count, students.length - report.provisional),
            () => openAct({ band: ui.band === i ? null : i }), ui.band === i))),
        e('div', { class: 'bar' },
          button('Veure qui té més suspensos', () => openAct({ sort: 'fail' })),
          button('Veure els balanços provisionals', () => openAct({ band: 'provisional' })))),
      subjectInsight(report)),
    e('nav', { class: 'tabs', 'aria-label': 'Vistes del grup' }, Object.keys(bodies).map(tab =>
      button(tab, () => switchTab(tab), { 'aria-pressed': String(ui.tab === tab) })),
    button('Genera l’acta', () => downloadActa(exportStatus), { class: 'primary acta-export',
      title: ui.hidden ? 'Descarrega el Word anonimitzat' : 'Descarrega el Word amb els noms de l’acta' })),
    exportStatus,
    bodies[ui.tab]());
}

function subjectPlot(grades, count) {
  return e('ul', { class: 'plot', 'aria-label': 'Distribució de la matèria per trams' }, subjectDistribution(grades).map(bin =>
    e('li', {}, e('span', {}, bin.label), e('meter', { min: 0, max: Math.max(1, count), value: bin.count,
      'aria-label': `${bin.label}: ${bin.count} notes` }), e('strong', {}, String(bin.count)))));
}

function subjectInsight(report) {
  const subjects = report.subjectRows.map(group => ({ ...group, stats: metrics(group.grades) }))
    .filter(group => group.stats.n)
    .sort((a, b) => b.stats.failed - a.stats.failed ||
      b.stats.failed / b.stats.n - a.stats.failed / a.stats.n || a.name.localeCompare(b.name, 'ca'));
  const detail = e('div', { id: 'subject-insight-detail', 'aria-live': 'polite' });
  const barMax = Math.max(1, ...subjects.map(group => group.stats.failed));
  const bars = [];
  function show(group) {
    ui.detailSubject = group.name;
    for (const [name, control] of bars) control.setAttribute('aria-pressed', String(name === group.name));
    const n = group.stats.n;
    detail.replaceChildren(e('h3', {}, group.name),
      hint(`${n} notes numèriques · ${ratio(group.stats.failed, n)} no superades`),
      subjectPlot(group.grades, n),
      e('div', { class: 'bar' },
        button('Veure les notes a l’acta', () => openAct({ subject: group.name })),
        button('Veure els suspesos a l’acta', () => openAct({ subject: group.name, subjectResult: 'failed' }))));
  }
  const rows = subjects.map(group => {
    const { n, failed } = group.stats;
    const label = ratio(failed, n);
    const control = button([
      e('strong', {}, group.name), e('span', { class: 'subject-ratio' }, label),
      e('meter', { min: 0, max: barMax, value: failed, 'aria-hidden': 'true' }),
    ], () => { show(group); detail.scrollIntoView({ block: 'nearest' }); },
    { class: 'subject-bar', 'aria-controls': 'subject-insight-detail', 'aria-pressed': 'false' });
    bars.push([group.name, control]);
    return e('li', {}, control);
  });
  const current = subjects.find(group => group.name === ui.detailSubject);
  if (current) show(current);
  return panel(e('h2', {}, 'Suspensos per matèria'),
    subjects.length ? hint('Barres ordenades pel nombre de suspesos. Tria una matèria per veure com es reparteixen les notes.') :
      hint('No hi ha notes numèriques amb la matèria identificada.'),
    subjects.length ? e('ul', { class: 'subject-bars', 'aria-label': 'Matèries ordenades per nombre de suspesos' }, rows) : null,
    detail);
}

function act(students, report) {
  const headers = session.headers;
  const filter = e('input', { type: 'search', placeholder: ui.hidden ? 'Número d’alumne' : 'Nom o número d’acta' });
  filter.value = ui.query;
  const wrap = e('div');
  const matches = e('p', { class: 'muted', role: 'status' });
  function fill() {
    const q = ui.query.toLocaleLowerCase('ca');
    const rows = students.map((student, index) => ({ student, index, total: totals(student) })).filter(({ student, index, total }) =>
      (ui.band === null || (typeof ui.band === 'number' ? !total.provisional && total.band === ui.band : balanceCategory(total) === ui.band)) &&
      (!ui.pair || failedBoth(student, ui.pair)) &&
      (!ui.subject || student.grades.some(grade => grade.subject.toLocaleLowerCase('ca') === ui.subject.toLocaleLowerCase('ca') &&
        (!ui.subjectResult || (grade.state === 'number' && grade.value < 5)))) &&
      (!ui.incidents || total.provisional) &&
      (!q || `${nameOf(student, index)} ${ui.hidden ? '' : student.ordinal}`.toLocaleLowerCase('ca').includes(q)));
    if (ui.sort === 'fail') rows.sort((a, b) => b.total.count - a.total.count || a.index - b.index);
    matches.textContent = `${rows.length} de ${students.length} alumnes`;
    const grid = table(['Alumne', headers[0], 'No superades', ...headers.slice(5)], rows.map(({ student, index, total }) => [
      button(nameOf(student, index), () => {
        const current = wrap.firstElementChild;
        ui.scroll = [current.scrollLeft, current.scrollTop];
        ui.actPageTop = window.scrollY;
        ui.index = index;
        openView('studentView');
      }, { class: 'link' }),
      ui.hidden ? String(index + 1) : student.ordinal,
      [String(total.count), total.provisional ? e('small', {}, 'Provisional') : null],
      ...headers.slice(5).map((_, i) => {
        const grades = student.grades.filter(grade => grade.column === i + 5);
        return grades.length ? grades.map(grade => e('div', {},
          grade.state !== 'empty' && (grade.slot || grade.subjectCode || grade.origin === 'docent') ?
            e('small', { class: 'cell-label' }, subjectLabel(grade)) : null, badge(grade))) : '—';
      }),
    ]), true);
    grid.classList.add('full-act');
    wrap.replaceChildren(grid);
    grid.scrollTo(...ui.scroll);
  }
  filter.addEventListener('input', () => { ui.query = filter.value.trim(); ui.scroll = [0, 0]; fill(); });
  const update = (key, value) => {
    ui[key] = value;
    ui.scroll = [0, 0];
    if (key === 'subject') { ui.subjectResult = ''; render(); }
    else fill();
  };
  const activeBand = typeof ui.band === 'number' ? `${ui.band === 4 ? '4 o més' : ui.band} no superades` : balanceLabels[ui.band];
  fill();
  return panel(e('h2', { id: 'group-act-title', tabindex: '-1' }, 'Acta interactiva'),
    e('div', { class: 'fields' }, field('Cerca', filter),
      field('Matèria', select([['', 'Totes'], ...report.subjectRows.map(({ name }) => [name, name])], ui.subject, value => update('subject', value))),
      field('Ordre', select([['acta', 'Ordre de l’acta'], ['fail', 'Més matèries no superades']], ui.sort, value => update('sort', value))),
      field('Registres', select([['', 'Tots'], ['pending', 'Amb balanç provisional']], ui.incidents ? 'pending' : '',
        value => update('incidents', Boolean(value))))),
    ui.band === null ? null : button(`Treu el filtre «${activeBand}»`, () => { ui.band = null; render(); }),
    ui.pair ? button(`Treu el filtre «Suspesos a ${ui.pair.join(' i ')}»`, () => { ui.pair = null; render(); }) : null,
    ui.subjectResult ? button(`Mostra tots els resultats de ${ui.subject}`, () => {
      ui.subjectResult = '';
      render();
      document.querySelector('#group-act-title').focus();
    }) : null,
    matches, wrap);
}

function openSubject(name) {
  ui.selectedMatter = name;
  ui.tab = 'Matèries';
  render();
  document.querySelector('#subject-profile-title').focus();
}

function subjects(report) {
  const current = report.subjectRows.find(group => group.name === ui.selectedMatter);
  if (current) return subjectProfile(current);
  const list = report.subjectRows.map(group => {
    const m = metrics(group.grades);
    const title = button(group.name, () => openSubject(group.name), { class: 'link' });
    return [title, String(m.n), String(m.passed), String(m.failed), ratio(m.passed, m.n), num(m.average), num(m.median),
      num(m.min), num(m.max), String(group.grades.filter(grade => grade.state === 'special').length),
      String(group.grades.filter(grade => ['missing', 'review'].includes(grade.state)).length)];
  });
  const grid = table([
      'Matèria', 'Notes', 'Aprovats', 'Suspesos', '% aprovats', 'Mitjana', 'Mediana', 'Mínim', 'Màxim', 'Estats', 'Pendents',
    ], list, false, 'Resultats per matèria', true);
  return panel(e('h2', { id: 'subject-list-title', tabindex: '-1' }, 'Resultats per matèria'),
    hint('Tria una matèria per obrir-ne la fitxa estadística. Els percentatges es calculen sobre les notes numèriques.'), grid);
}

function analysis(students, report) {
  const profiles = report.subjectRows.map(({ name, grades }) => ({
    name, bins: subjectDistribution(grades), n: grades.filter(grade => grade.state === 'number').length,
  })).filter(profile => profile.n > 0);
  const names = profiles.map(profile => profile.name);
  const failures = failureConcentration(students);
  const labels = ['Per sota de 4', 'A prop del 5 · 4–<5', 'Bé o suficient · 5–<7', 'Notable · 7–<9', 'Excel·lent · 9–10'];
  const profilesTable = profiles.length ? table(['Matèria', ...labels], profiles.map(({ name, bins, n }) => [
    e('div', { class: 'profile-name' }, button(name, () => openSubject(name), { class: 'link' }),
      e('small', {}, `${n} ${n === 1 ? 'nota' : 'notes'}`)),
    ...bins.map(({ count }, i) => e('div', { class: `profile-bin grade-bin-${i}` },
      e('strong', {}, String(count)),
      e('span', { class: 'profile-plot', 'aria-hidden': 'true' },
        e('meter', { min: 0, max: n, value: count })))),
  ]), false, 'Perfil de notes per matèria', true) : null;
  profilesTable?.classList.add('subject-profiles');
  const profilesPanel = panel(e('h2', {}, 'Perfil de notes per matèria'),
    profiles.length ? hint('El número indica quantes notes hi ha a cada tram. L’alçada de la barra mostra quina part del total de la matèria representen.') :
      hint('No hi ha notes numèriques amb la matèria identificada.'),
    profilesTable);

  const matrix = subjectPairs(students, names);
  const pairsPanel = panel(e('h2', {}, 'Coincidència de suspensos'),
    hint('Cada casella mostra els alumnes que suspenen totes dues matèries sobre els que tenen una única nota numèrica en cadascuna.'),
    names.length < 2 ? hint('Calen dues matèries amb notes numèriques per comparar.') :
      table(['Matèria', ...names], names.map((name, i) => [name, ...names.map((other, j) => {
        if (j >= i) return '—';
        const { n, failed } = matrix[i][j];
        if (!n) return '—';
        const label = ratio(failed, n);
        if (!failed) return label;
        return button(label, () => openAct({ pair: [name, other] }), {
          class: 'pair-cell',
          'aria-label': `${name} i ${other}: ${label} suspenen totes dues`,
        });
      })]), true, 'Matriu de coincidències de suspensos'));

  const concentration = panel(e('h2', {}, 'Com es reparteixen els suspensos'),
    report.failed ? hint(`${report.failed} qualificacions numèriques no superades. Les notes de franja també compten.`) :
      hint('El grup no té qualificacions numèriques no superades.'),
    report.failed ? e('ul', { class: 'subject-bars' }, Object.entries(failures).map(([key, count]) =>
      e('li', {}, button([
        e('strong', {}, balanceLabels[key]), e('span', { class: 'subject-ratio' }, ratio(count, report.failed)),
        e('meter', { min: 0, max: report.failed, value: count, 'aria-hidden': 'true' }),
      ], () => openAct({ band: key, sort: 'fail' }), { class: 'subject-bar', disabled: !count ? '' : undefined })))) : null);
  return e('section', {}, profilesPanel, pairsPanel, concentration);
}

function subjectProfile({ name, grades }) {
  const m = metrics(grades);
  const statuses = Object.entries(states).map(([code, label]) =>
    [label, grades.filter(grade => grade.special === code).length]);
  const pending = grades.filter(grade => grade.state === 'review').length;
  const missing = grades.filter(grade => grade.state === 'missing').length;
  const nonNumeric = [...statuses, ['Sense nota', missing], ['Pendent de revisió', pending]]
    .filter(([, count]) => count);
  return panel(
    button('← Totes les matèries', () => {
      ui.selectedMatter = '';
      render();
      document.querySelector('#subject-list-title').focus();
    }),
    e('h2', { id: 'subject-profile-title', class: 'subject-title', tabindex: '-1' }, name),
    e('div', { class: 'stats' },
      stat('Notes numèriques', m.n), stat('Aprovades', ratio(m.passed, m.n)),
      stat('No superades', ratio(m.failed, m.n)), stat('Sense nota numèrica', grades.length - m.n)),
    e('div', { class: 'group-insights' },
      e('section', {},
        e('h3', {}, 'Estadístiques descriptives'),
        e('div', { class: 'stats' }, stat('Mitjana', num(m.average)), stat('Mediana', num(m.median)),
          stat('Mínim', num(m.min)), stat('Màxim', num(m.max)), stat('Desviació estàndard', num(m.deviation))),
        nonNumeric.length ? e('p', { class: 'muted' }, nonNumeric.map(([label, count]) => `${label} (${count})`).join(' · ')) : null),
      e('section', {},
        e('h3', {}, 'Distribució de notes'),
        m.n ? subjectPlot(grades, m.n) : hint('Aquesta matèria encara no té notes numèriques.'))),
    e('div', { class: 'bar' },
      button('Veure les notes a l’acta', () => openAct({ subject: name })),
      button('Veure els suspesos a l’acta', () => openAct({ subject: name, subjectResult: 'failed' }),
        { disabled: !m.failed ? '' : undefined })));
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
      'Estats', 'Sense nota', 'Pendents de revisió'], (session.level === 2 ? [1] : [1, 2, 3]).map(slot => {
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

function studentGrades(grades, notes) {
  const middle = Math.ceil(grades.length / 2);
  const blocks = [grades.slice(0, middle), grades.slice(middle)].filter(block => block.length);
  return e('div', { class: 'student-grade-grid' }, blocks.map((block, i) =>
    e('table', { class: 'student-grades', 'aria-label': `Qualificacions · bloc ${i + 1}` },
      e('thead', {}, e('tr', {},
        e('th', { scope: 'col' }, 'Matèria'),
        e('th', { scope: 'col', class: 'student-scale' },
          e('span', {}, '0'), e('span', {}, '5'), e('span', {}, '10')),
        e('th', { scope: 'col' }, 'Nota o estat'))),
      e('tbody', {}, block.map(grade => e('tr', {},
        e('th', { scope: 'row' }, subjectLabel(grade),
          grade.slot && grade.subject ? e('small', { class: 'student-band' }, `Franja ${grade.slot}`) : null),
        e('td', {}, grade.state === 'number' ? e('span', { class: 'student-meter', 'aria-hidden': 'true' },
          e('meter', { min: 0, max: 10, value: grade.value, class: grade.value < 5 ? 'below-pass' : 'at-pass' })) : null),
        e('td', { class: 'student-result' }, badge(grade),
          grade.state === 'number' && grade.value === notes.max ? e('small', { class: 'grade-extreme' }, 'MÀX') : null,
          grade.state === 'number' && grade.value === notes.min ? e('small', { class: 'grade-extreme minimum' }, 'MÍN') : null)))))));
}

function studentRing(bins, total) {
  const colors = ['#8aeba4', '#55cbb4', '#f1cf85', '#f17a70'];
  const canvas = e('canvas', { width: 260, height: 260, 'aria-hidden': 'true' });
  const context = canvas.getContext('2d');
  const full = 2 * Math.PI;
  const initial = -Math.PI / 2;
  let running = 0;
  const parts = bins.map(({ count }) => {
    const from = full * running / total;
    running += count;
    return { from, to: full * running / total };
  });
  const center = e('strong', { 'aria-hidden': 'true' }, `${total} notes`);
  const detail = e('p', { class: 'ring-detail muted', role: 'status' }, 'Assenyala un tram per veure’n el recompte.');
  let pinned = -1;
  let active = -2;
  const buttons = bins.map(({ label, count }, i) => {
    const option = button(`${label} · ${count}`, () => {
      pinned = pinned === i ? -1 : i;
      show(pinned);
    }, { class: `ring-option grade-bin-${[4, 3, 2, 0][i]}`, 'aria-pressed': 'false',
      onpointerenter: () => show(i), onpointerleave: () => show(pinned),
      onfocus: () => show(i), onblur: () => show(pinned) });
    return option;
  });
  function show(index) {
    buttons.forEach((option, i) => option.setAttribute('aria-pressed', String(i === pinned)));
    if (active === index) return;
    active = index;
    const selected = bins[index];
    center.textContent = selected ? `${selected.count} de ${total}` : `${total} notes`;
    detail.textContent = selected ? `${selected.label}: ${ratio(selected.count, total)}` :
      'Assenyala un tram per veure’n el recompte.';
    if (!context) return;
    context.clearRect(0, 0, 260, 260);
    parts.forEach(({ from, to }, i) => {
      if (from === to) return;
      context.beginPath();
      context.arc(130, 130, 94, initial + from, initial + to);
      context.strokeStyle = colors[i];
      context.lineWidth = 44;
      context.globalAlpha = index < 0 || i === index ? 1 : .35;
      context.stroke();
    });
    context.globalAlpha = 1;
  }
  function atPointer(event) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return -1;
    const x = (event.clientX - rect.left) * 260 / rect.width - 130;
    const y = (event.clientY - rect.top) * 260 / rect.height - 130;
    const radius = Math.hypot(x, y);
    if (radius < 72 || radius > 116) return -1;
    const angle = (Math.atan2(y, x) - initial + full) % full;
    return parts.findIndex(({ from, to }) => angle >= from && angle < to);
  }
  canvas.addEventListener('pointermove', event => {
    const index = atPointer(event);
    show(index < 0 ? pinned : index);
  });
  canvas.addEventListener('pointerleave', () => show(pinned));
  canvas.addEventListener('click', event => {
    const index = atPointer(event);
    pinned = pinned === index ? -1 : index;
    show(pinned);
  });
  show(-1);
  return e('div', { class: 'student-distribution' },
    e('div', { class: 'student-ring' }, canvas, center),
    e('div', {}, e('ul', { class: 'grade-legend student-legend' }, buttons.map(option => e('li', {}, option))), detail));
}

function studentRadar(domains) {
  const canvas = e('canvas', { class: 'student-radar', width: 560, height: 330, 'aria-hidden': 'true' });
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const cx = 280, cy = 165, radius = 109;
  const angles = domains.map((_, index) => 2 * Math.PI * index / domains.length - Math.PI / 2);
  const point = (angle, ratio) => [cx + radius * ratio * Math.cos(angle), cy + radius * ratio * Math.sin(angle)];
  function polygon(values) {
    ctx.beginPath();
    values.forEach((value, i) => i === 0 ? ctx.moveTo(...point(angles[i], value)) : ctx.lineTo(...point(angles[i], value)));
    ctx.closePath();
  }
  ctx.strokeStyle = '#6b7c96';
  ctx.lineWidth = 1.5;
  for (const mark of [.2, .4, .6, .8, 1]) {
    polygon(angles.map(() => mark));
    ctx.stroke();
  }
  angles.forEach(angle => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(...point(angle, 1));
    ctx.stroke();
  });
  polygon(domains.map(domain => domain.average / 10));
  ctx.fillStyle = '#00e67635';
  ctx.fill();
  ctx.strokeStyle = '#00e676';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#e6edf7';
  ctx.font = '15px system-ui';
  ctx.textBaseline = 'middle';
  domains.forEach(({ name }, i) => {
    const angle = angles[i];
    const side = Math.cos(angle);
    ctx.textAlign = side > .18 ? 'left' : side < -.18 ? 'right' : 'center';
    ctx.fillText(name, ...point(angle, 1.15));
  });
  return canvas;
}

function individualInsights({ notes, bins, domains, comparisons, percentile }) {
  const spread = Math.max(2, Math.ceil(Math.max(0, ...comparisons.map(row => Math.abs(row.delta)))));
  const sign = value => Math.abs(value) < .005 ? '0' : `${value > 0 ? '+' : '−'}${num(Math.abs(value))}`;
  return [
    panel(e('h2', {}, 'Distribució i dispersió'),
      notes.n ? e('div', { class: 'group-insights' },
        studentRing(bins, notes.n),
        e('section', { class: 'student-spread' },
          e('h3', {}, 'Desviació estàndard'),
          e('strong', {}, `${num(notes.deviation)} punts`),
          e('meter', { min: 0, max: 5, value: notes.deviation, 'aria-label': 'Desviació estàndard en punts' }),
          hint('Escala de 0 a 5 punts. Com més baixa, més agrupades estan les notes d’aquesta acta.'))) :
        hint('No hi ha notes numèriques per calcular la distribució.')),
    panel(e('h2', {}, 'Comparació amb el grup'),
      percentile ? hint(`Percentil ${Math.round(percentile.percentile)} · ${percentile.n} alumnes comparats en les mateixes ${percentile.subjects} matèries comunes. Els empats comparteixen posició.`) :
        hint('El percentil requereix almenys dues matèries comunes amb nota i dos alumnes comparables.'),
      comparisons.length ? [
        hint('La mitjana de cada matèria inclou l’alumne i els companys amb una única nota numèrica en aquella matèria.'),
        e('div', { class: 'comparison-scale', 'aria-hidden': 'true' }, e('span', {}, `−${spread}`), e('span', {}, '0'), e('span', {}, `+${spread}`)),
        e('ul', { class: 'student-comparisons' }, comparisons.map(({ name, value, average, n, delta }) =>
          e('li', {},
            e('div', { class: 'comparison-label' }, e('strong', {}, name),
              e('small', {}, `Nota ${num(value)} · grup ${num(average)} · ${n} alumnes`)),
            e('span', { class: 'comparison-track', 'aria-hidden': 'true' },
              e('meter', { min: 0, max: spread, value: Math.max(0, -delta), class: 'comparison-negative' }),
              e('meter', { min: 0, max: spread, value: Math.max(0, delta) })),
            e('strong', { class: Math.abs(delta) < .005 ? '' : delta < 0 ? 'fail' : 'ok' }, `${sign(delta)} p`)))),
      ] : hint('No hi ha matèries amb prou notes comparables.')),
    panel(e('h2', {}, 'Perfil per àmbits'),
      hint('Només es mostren els àmbits amb notes. Educació Física, Treball de Recerca i les franges sense matèria es poden consultar a la taula.'),
      domains.length >= 3 ? studentRadar(domains) : hint(domains.length ?
        'Calen tres àmbits amb notes per dibuixar la teranyina.' : 'No hi ha àmbits amb notes classificables.'),
      domains.length ? e('div', { class: 'stats' }, domains.map(({ name, average, n }) =>
        stat(`${name} · ${n} ${n === 1 ? 'nota' : 'notes'}`, num(average)))) : null),
  ];
}

function studentView() {
  const student = session.students[ui.index];
  const total = totals(student);
  const insights = studentAnalysis(student, session.students);
  const { notes } = insights;
  const grades = student.grades.filter(grade => grade.state !== 'empty');
  const pending = grades.filter(grade => ['missing', 'review'].includes(grade.state) ||
    ['NP', 'PQ'].includes(grade.special)).length;
  return e('section', { class: 'student-view' },
    e('div', { class: 'student-heading' },
      e('div', {}, e('h1', { tabindex: '-1' }, nameOf(student, ui.index)),
        hint(`Alumne ${ui.index + 1} de ${session.students.length}${total.provisional ? ' · Balanç provisional' : ''}`)),
      e('div', { class: 'bar' },
        button('Torna al grup', () => {
          ui.view = 'summary';
          render();
          document.querySelector('#group-act-title').focus({ preventScroll: true });
          window.scrollTo(0, ui.actPageTop);
        }),
        button('← Anterior', () => move(-1), { disabled: ui.index === 0 ? '' : undefined }),
        button('Següent →', () => move(1), { disabled: ui.index + 1 === session.students.length ? '' : undefined }))),
    e('div', { class: 'stats student-stats' }, stat('Superades', notes.passed),
      stat('No superades', total.count), stat('Pendents', pending),
      stat('Mitjana · notes disponibles', num(notes.average)), stat('Mediana', num(notes.median))),
    e('section', { class: 'panel student-panel' }, e('h2', {}, 'Qualificacions'),
      studentGrades(grades, notes)),
    individualInsights(insights));
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
