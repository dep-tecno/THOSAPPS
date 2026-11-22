export const headers = ['N.', "Identificador de l’alumne/a", "Cognoms i nom de l’alumne/a Document",
  'Modalitat', 'Nr. mat.', 'Ll. Cat.', 'Ll. Cast.', 'Ll. Estr.', 'Ed. Fis.', 'Filo.',
  'Mod. Ob.', 'Mod. 1', 'Mod. 2', 'Opt. 1', 'Opt. 2', 'Opt. 3', 'Rel', 'Altres matèries'];

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
  ...optionalSubjects,
};
const fixed = {
  5: 'Llengua Catalana i Literatura I', 6: 'Llengua Castellana i Literatura I',
  8: 'Educació Física', 9: 'Filosofia', 16: 'Religió',
};
const stateCode = value => Object.hasOwn(states, value);
const code = value => /^[A-Z][A-Z0-9]*$/.test(value ?? '') && !stateCode(value);
const score = value => /^(?:[0-9]|10)(?:[.,]\d+)?$/.test(value ?? '') && Number(value.replace(',', '.')) <= 10;
const result = value => stateCode(value) || score(value);
const normalized = value => String(value ?? '').normalize('NFC').replaceAll('’', "'").replace(/\s+/g, ' ').trim();
const keys = headers.map(normalized);
const split = value => String(value ?? '').split(/\r?\n/).map(normalized).filter(Boolean);
const subjectKey = name => name.normalize('NFC').toLocaleLowerCase('ca');
const sameResult = (a, b) => a === b || (score(a) && score(b) && Number(a.replace(',', '.')) === Number(b.replace(',', '.')));

function readGrade(raw, column, source, modality) {
  const lines = split(raw);
  const slot = column >= 13 && column <= 15 ? column - 12 : null;
  const grade = { column, source, raw: raw ?? '', slot, subject: fixed[column] ?? '', subjectCode: '',
    type: slot ? 'optativa' : column <= 9 ? 'comuna' : column <= 12 ? 'modalitat' : 'altres',
    state: lines.length || column <= 12 ? 'missing' : 'empty', value: null, special: '', origin: 'acta' };
  let value;
  if (!lines.length) return grade;
  if (slot) {
    const [band, first, name, repeat] = lines;
    const expected = modality === '2000' ? 'C' : modality === '3000' ? 'S' : '[CS]';
    if (!new RegExp(`^O${expected}${slot}1$`).test(band)) return { ...grade, state: 'review' };
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
  } else if (fixed[column] && lines.length === 1 && result(lines[0])) {
    value = lines[0];
  } else if ([7, 10, 11, 12, 17].includes(column) && code(lines[0]) && lines.length <= 2) {
    grade.subjectCode = lines[0];
    grade.subject = Object.hasOwn(subjects, lines[0]) ? subjects[lines[0]] : lines[0];
    if (lines.length === 1) return grade;
    value = lines[1];
  }
  if (score(value)) return { ...grade, state: 'number', value: Number(value.replace(',', '.')) };
  if (stateCode(value)) return { ...grade, state: 'special', special: value };
  return { ...grade, state: 'review' };
}

export function importAct(book) {
  const students = [];
  const rejected = [];
  const ids = new Set();
  let compatible = 0;
  for (const sheet of book) {
    const first = sheet.rows.findIndex(row => keys.every((key, i) => normalized(row.cells[i]) === key) &&
      !row.cells.slice(18).some(normalized));
    if (first < 0) {
      rejected.push({ source: sheet.name, reason: 'Capçalera incompatible' });
      continue;
    }
    compatible++;
    for (const row of sheet.rows.slice(first + 1)) {
      if (!row.cells.some(normalized)) continue;
      const source = `${sheet.name}, fila ${row.number}`;
      const [ordinal, id, identity, modality, registration] = row.cells;
      if (!/^\d+$/.test(normalized(ordinal)) || !normalized(id) || !normalized(identity) || row.cells.slice(18).some(normalized)) {
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
      students.push({
        ordinal: normalized(ordinal), id: normalized(id), name: identityLines.join(' '), document,
        modality: normalized(modality), registration: normalized(registration),
        grades: headers.slice(5).map((_, i) => readGrade(row.cells[i + 5], i + 5,
          `${sheet.name}!${String.fromCharCode(70 + i)}${row.number}`, normalized(modality))),
      });
    }
  }
  if (!compatible) throw Error('No s’han trobat les 18 capçaleres del format THOSSCAN de 1r de batxillerat.');
  if (!students.length) throw Error('El llibre no conté cap registre d’alumne interpretable.');
  return { students, rejected };
}

export function totals(student) {
  const count = student.grades.filter(grade => grade.state === 'number' && grade.value < 5).length;
  const provisional = student.grades.some(grade => ['missing', 'review'].includes(grade.state) ||
    ['NP', 'PQ'].includes(grade.special));
  return { count, provisional, band: Math.min(count, 4) };
}

export function assignSubject(grades, name) {
  const subject = normalized(name);
  if (!subject) return;
  for (const grade of grades) {
    if (canAssign(grade)) Object.assign(grade, { subject, origin: 'docent' });
  }
}

export function canAssign(grade) {
  return Boolean(grade.slot && !grade.subject && ['number', 'special'].includes(grade.state));
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
  let provisional = 0;
  for (const student of students) {
    const t = totals(student);
    if (t.provisional) provisional++;
    else distribution[t.band]++;
  }
  const groups = new Map();
  for (const grade of grades) {
    if (!grade.subject || grade.state === 'empty') continue;
    const key = subjectKey(grade.subject);
    if (!groups.has(key)) groups.set(key, { name: grade.subject, grades: [] });
    groups.get(key).grades.push(grade);
  }
  const subjectRows = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'ca'));
  return { grades, distribution, provisional, subjectRows, ...metrics(grades) };
}
