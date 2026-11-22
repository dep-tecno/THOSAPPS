export const headers = ['N.', "Identificador de l’alumne/a", "Cognoms i nom de l’alumne/a Document",
  'Modalitat', 'Nr. mat.', 'Ll. Cat.', 'Ll. Cast.', 'Ll. Estr.', 'Ed. Fis.', 'Filo.',
  'Mod. Ob.', 'Mod. 1', 'Mod. 2', 'Opt. 1', 'Opt. 2', 'Opt. 3', 'Rel', 'Altres matèries'];
export const secondHeaders = [...headers.slice(0, 8), 'Hist. Filo.', 'Hist.', 'Mod. Ob.',
  'Mod. 1', 'Mod. 2', 'Opt. 1', 'Treb. recer.', 'Altres matèries'];

export const states = { CV: 'Convalidat', XM: 'Exempt', R: 'Renúncia', PQ: 'Pendent de qualificar', NP: 'No presentat' };
export const optionalSubjects = {
  FUEM: 'Funcionament de l’empresa', CL: 'Creació literària', CIPOD: 'Ciutadania, política i dret',
  FI: 'Física', BMD: 'Biomedicina', REPCI: 'Reptes Científics', CED: 'Comerç Electrònic',
  PS: 'Problemàtiques socials', SLA: 'Segona llengua estrangera: Alemany', COAUD: 'Comunicació Audiovisual',
  LLPRO: 'Llenguatges de programació', IPO: 'Itinerari personal per a l’ocupabilitat', RO: 'Robòtica',
};
const subjects = {
  IA1: 'Llengua Estrangera I: Anglès', MP1: 'Matemàtiques Aplicades CS I', ECO: 'Economia',
  HMO: 'Història del Món Contemporani', LL1: 'Llengua i Cultura Llatines I', LA: 'Llengua i Cultura Llatines I',
  GR1: 'Llengua i Cultura Gregues I', LIU: 'Literatura Universal', MA1: 'Matemàtiques I',
  BI1: 'Biologia I', QU1: 'Química I', DT1: 'Dibuix Tècnic I', TE1: 'Tecnologia i Enginyeria I',
  IA2: 'Llengua Estrangera II: Anglès', MA2: 'Matemàtiques II', BI2: 'Biologia II', QU2: 'Química II',
  DT2: 'Dibuix Tècnic II', TE2: 'Tecnologia i Enginyeria II', FI2: 'Física II', MP2: 'Matemàtiques Aplicades CS II',
  LL2: 'Llengua i Cultura Llatines II', GR2: 'Llengua i Cultura Gregues II', GEO: 'Geografia',
  HAR: 'Història de l’Art', EDN: 'Funcionament de l’Empresa i Disseny de Models de Negoci',
  LC1: 'Llengua Catalana i Literatura I', LS1: 'Llengua Castellana i Literatura I', FIL: 'Filosofia',
  ...optionalSubjects,
};
const fixed = {
  5: 'Llengua Catalana i Literatura I', 6: 'Llengua Castellana i Literatura I',
  8: 'Educació Física', 9: 'Filosofia', 16: 'Religió',
};
const layouts = [
  { level: 1, headers, slots: 3, fixed },
  { level: 2, headers: secondHeaders, slots: 1, fixed: {
    5: 'Llengua Catalana i Literatura II', 6: 'Llengua Castellana i Literatura II',
    8: 'Història de la Filosofia', 9: 'Història', 14: 'Treball de Recerca',
  } },
];
const stateCode = value => Object.hasOwn(states, value);
const code = value => /^[A-Z][A-Z0-9]*$/.test(value ?? '') && !stateCode(value);
const score = value => /^(?:[0-9]|10)(?:[.,]\d+)?$/.test(value ?? '') && Number(value.replace(',', '.')) <= 10;
const result = value => stateCode(value) || score(value);
const normalized = value => String(value ?? '').normalize('NFC').replaceAll('’', "'").replace(/\s+/g, ' ').trim();
const headerKey = value => normalized(value).toLocaleLowerCase('ca').replace(/\.\s*/g, '.');
const split = value => String(value ?? '').split(/\r?\n/).map(normalized).filter(Boolean);
export const subjectKey = name => name.normalize('NFC').toLocaleLowerCase('ca');
const sameResult = (a, b) => a === b || (score(a) && score(b) && Number(a.replace(',', '.')) === Number(b.replace(',', '.')));

function readGrade(raw, column, source, modality, layout) {
  const lines = split(raw);
  const slot = column >= 13 && column < 13 + layout.slots ? column - 12 : null;
  const grade = { column, source, raw: raw ?? '', slot, label: layout.headers[column],
    subject: layout.fixed[column] ?? '', subjectCode: '',
    type: slot ? 'optativa' : column <= 9 ? 'comuna' : column <= 12 ? 'modalitat' : 'altres',
    state: lines.length || column <= 12 ? 'missing' : 'empty', value: null, special: '', origin: 'acta' };
  let value;
  if (!lines.length) return grade;
  if (slot) {
    const [band, first, name, repeat] = lines;
    const expected = modality === '2000' ? 'C' : modality === '3000' ? 'S' : '[CS]';
    if (!new RegExp(`^O${expected}${slot}${layout.level}$`).test(band)) return { ...grade, state: 'review' };
    grade.band = band;
    if (lines.length === 1) return grade;
    if (!result(first)) return { ...grade, state: 'review' };
    value = first;
    if (lines.length > 2) {
      // A single code may accompany the band grade even when the PDF omits its repeated copy.
      if (!code(name) || lines.length > 4 || (repeat !== undefined && !sameResult(first, repeat))) {
        return { ...grade, state: 'review' };
      }
      grade.subjectCode = name;
      grade.subject = Object.hasOwn(optionalSubjects, name) ? optionalSubjects[name] : '';
      grade.origin = grade.subject ? 'catàleg' : 'acta';
    }
  } else if (layout.fixed[column] && lines.length === 1 && result(lines[0])) {
    value = lines[0];
  } else if ([7, 10, 11, 12, layout.headers.length - 1].includes(column) && code(lines[0]) && lines.length <= 2) {
    grade.subjectCode = lines[0];
    grade.subject = layout.level === 2 && lines[0] === 'LA' ? subjects.LL2 :
      Object.hasOwn(subjects, lines[0]) ? subjects[lines[0]] : lines[0];
    if (lines.length === 1) return grade;
    value = lines[1];
  }
  if (score(value)) return { ...grade, state: 'number', value: Number(value.replace(',', '.')) };
  if (stateCode(value)) return { ...grade, state: 'special', special: value };
  return { ...grade, state: 'review' };
}

function findLayout(cells) {
  return layouts.find(layout => {
    const last = layout.headers.length - 1;
    return layout.headers.slice(0, last).every((label, i) => headerKey(label) === headerKey(cells[i])) &&
      headerKey(cells.slice(last).map(normalized).filter(Boolean).join(' ')) === headerKey(layout.headers[last]);
  });
}

function coverContext(sheet) {
  const fields = sheet.rows.flatMap(row => row.cells.map(normalized));
  if (!fields.some(field => /^Acta de qualificacions/i.test(field))) return null;
  const year = fields.map(field => /Curs acadèmic\s+(\d{4}\/\d{4})/i.exec(field)?.[1]).find(Boolean);
  const group = fields.find(field => /^BATX[A-Z]+\d{7}$/i.test(field));
  const period = fields.map(field => /avaluació parcial\s+(\d+)/i.exec(field)?.[1]).find(Boolean);
  const date = fields.map(field => /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(field)).find(Boolean);
  return { year, group, period: period ? `Avaluació parcial ${period}` : undefined,
    date: date ? `${date[3]}-${date[2].padStart(2, '0')}-${date[1].padStart(2, '0')}` : undefined };
}

export function importAct(book) {
  const students = [];
  const rejected = [];
  const ids = new Set();
  let actLayout;
  let context = {};
  for (const sheet of book) {
    let layout;
    const first = sheet.rows.findIndex(row => (layout = findLayout(row.cells)));
    if (first < 0) {
      const cover = coverContext(sheet);
      if (cover) context = { ...context, ...Object.fromEntries(Object.entries(cover).filter(([, value]) => value)) };
      else rejected.push({ source: sheet.name, reason: 'Capçalera incompatible' });
      continue;
    }
    if (actLayout && actLayout !== layout) throw Error('El llibre barreja actes de 1r i 2n. Importa cada nivell per separat.');
    actLayout = layout;
    for (const row of sheet.rows.slice(first + 1)) {
      if (!row.cells.some(normalized)) continue;
      const source = `${sheet.name}, fila ${row.number}`;
      const [ordinal, id, identity, modality, registration] = row.cells;
      if (!/^\d+$/.test(normalized(ordinal)) || !normalized(id) || !normalized(identity) ||
          (layout.level === 1 && row.cells.slice(headers.length).some(normalized))) {
        rejected.push({ source, reason: 'Registre incomplet o estructura inesperada' });
        continue;
      }
      if (ids.has(normalized(id))) {
        rejected.push({ source, reason: 'Identificador repetit' });
        continue;
      }
      ids.add(normalized(id));
      const identityLines = split(identity);
      const last = identityLines.at(-1);
      const document = /^[A-Z]?\d{7,9}[A-Z]$/i.test(last) ? identityLines.pop() : '';
      const lastColumn = layout.headers.length - 1;
      const grades = layout.headers.slice(5, lastColumn).map((_, i) =>
        readGrade(row.cells[i + 5], i + 5, `${sheet.name}!${String.fromCharCode(70 + i)}${row.number}`, normalized(modality), layout));
      // THOSSCAN can split the "Altres matèries" region into several physical XLSX cells.
      const extras = row.cells.slice(lastColumn).flatMap((value, i) => normalized(value) ?
        [readGrade(value, lastColumn, `${sheet.name}!${String.fromCharCode(65 + lastColumn + i)}${row.number}`,
          normalized(modality), layout)] : []);
      grades.push(...(extras.length ? extras : [readGrade('', lastColumn, source, normalized(modality), layout)]));
      students.push({
        ordinal: normalized(ordinal), id: normalized(id), name: identityLines.join(' '), document,
        modality: normalized(modality), registration: normalized(registration),
        grades,
      });
    }
  }
  if (!actLayout) throw Error('No s’ha trobat cap capçalera compatible amb les actes de batxillerat.');
  if (!students.length) throw Error('El llibre no conté cap registre d’alumne interpretable.');
  return { students, rejected, context, level: actLayout.level, headers: actLayout.headers };
}

export function totals(student) {
  const count = student.grades.filter(grade => grade.state === 'number' && grade.value < 5).length;
  const provisional = student.grades.some(grade => ['missing', 'review'].includes(grade.state) ||
    ['NP', 'PQ'].includes(grade.special));
  return { count, provisional, band: Math.min(count, 4) };
}

export const balanceLabels = {
  passed: 'Tot aprovat',
  some: '1–2 matèries no superades',
  many: '3 o més matèries no superades',
  provisional: 'Balanç provisional',
};

export function balanceCategory(total) {
  if (total.provisional) return 'provisional';
  if (total.count === 0) return 'passed';
  if (total.count <= 2) return 'some';
  return 'many';
}

export function subjectDistribution(grades) {
  const bins = [
    { label: '0–<4', limit: 4, count: 0 },
    { label: '4–<5', limit: 5, count: 0 },
    { label: '5–<7', limit: 7, count: 0 },
    { label: '7–<9', limit: 9, count: 0 },
    { label: '9–10', limit: Infinity, count: 0 },
  ];
  for (const grade of grades) {
    if (grade.state === 'number') bins.find(bin => grade.value < bin.limit).count++;
  }
  return bins;
}

export function subjectPairs(students, names) {
  const keys = names.map(subjectKey);
  const matrix = keys.map((_, i) => Array.from({ length: i }, () => ({ n: 0, failed: 0 })));
  for (const student of students) {
    const marks = new Map();
    for (const grade of student.grades) {
      if (!grade.subject || grade.state !== 'number') continue;
      const key = subjectKey(grade.subject);
      marks.set(key, marks.has(key) ? null : grade.value);
    }
    const values = keys.map(key => marks.get(key));
    for (let i = 1; i < values.length; i++) {
      if (values[i] == null) continue;
      for (let j = 0; j < i; j++) {
        if (values[j] == null) continue;
        matrix[i][j].n++;
        if (values[i] < 5 && values[j] < 5) matrix[i][j].failed++;
      }
    }
  }
  return matrix;
}

export function failedBoth(student, names) {
  return names.every(name => {
    const matches = student.grades.filter(grade => grade.state === 'number' &&
      subjectKey(grade.subject) === subjectKey(name));
    return matches.length === 1 && matches[0].value < 5;
  });
}

export function failureConcentration(students) {
  const counts = { some: 0, many: 0, provisional: 0 };
  for (const student of students) {
    const total = totals(student);
    const category = balanceCategory(total);
    if (category !== 'passed') counts[category] += total.count;
  }
  return counts;
}

export function assignSubject(grades, name) {
  const subject = normalized(name);
  for (const grade of grades) {
    if (canMapCode(grade)) Object.assign(grade, { subject, origin: subject ? 'docent' : 'acta' });
  }
}

export function hasUnnamedOptative(grade) {
  return Boolean(grade.slot && !grade.subject && ['number', 'special'].includes(grade.state));
}

function canMapCode(grade) {
  return Boolean(grade.subjectCode && (hasUnnamedOptative(grade) || grade.origin === 'docent'));
}

export function optativeMappings(students) {
  const mappings = new Map();
  for (const student of students) {
    for (const grade of student.grades.filter(canMapCode)) {
      const key = JSON.stringify([student.modality, grade.subjectCode]);
      if (!mappings.has(key)) {
        mappings.set(key, { key, code: grade.subjectCode, modality: student.modality, grades: [] });
      }
      mappings.get(key).grades.push(grade);
    }
  }
  return [...mappings.values()].sort((a, b) => a.code.localeCompare(b.code, 'ca') || a.modality.localeCompare(b.modality));
}

export function gradeLabel(grade) {
  if (grade.state === 'number') return grade.value.toLocaleString('ca');
  if (grade.state === 'special') return states[grade.special];
  if (grade.state === 'review') return 'Pendent de revisió';
  if (grade.state === 'missing') return 'Sense nota';
  return '—';
}

export function metrics(grades) {
  const values = grades.filter(g => g.state === 'number').map(g => g.value).sort((a, b) => a - b);
  const n = values.length;
  const sum = values.reduce((a, b) => a + b, 0);
  const passed = values.filter(value => value >= 5).length;
  const average = n ? sum / n : null;
  return {
    n, passed, failed: n - passed, average,
    median: n ? (values[Math.floor((n - 1) / 2)] + values[Math.floor(n / 2)]) / 2 : null,
    min: values[0], max: values.at(-1),
    deviation: n ? Math.sqrt(values.reduce((s, v) => s + (v - average) ** 2, 0) / n) : null,
  };
}

export function summarize(students) {
  const grades = students.flatMap(student => student.grades);
  const distribution = [0, 0, 0, 0, 0];
  const balances = { passed: 0, some: 0, many: 0, provisional: 0 };
  for (const student of students) {
    const t = totals(student);
    balances[balanceCategory(t)]++;
    if (!t.provisional) distribution[t.band]++;
  }
  const groups = new Map();
  for (const grade of grades) {
    if (!grade.subject || grade.state === 'empty') continue;
    const key = subjectKey(grade.subject);
    if (!groups.has(key)) groups.set(key, { name: grade.subject, grades: [] });
    groups.get(key).grades.push(grade);
  }
  const subjectRows = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'ca'));
  return { grades, distribution, balances, provisional: balances.provisional, subjectRows, ...metrics(grades) };
}
