import assert from 'node:assert/strict';
import test from 'node:test';
import { studentAnalysis } from '../student-analysis.mjs';
import { assignColumn, assignSubject, balanceCategory, failedBoth, failureConcentration, hasUnnamedOptative, headers,
  importAct, metrics, optativeMappings, secondHeaders, subjectDistribution, subjectPairs, summarize, totals } from '../grades.mjs';

function workbook(optatives, options = {}) {
  const row = ['1', 'ID-SINTETIC', 'Alumne de prova', '3000', '1', options.catalan ?? '6', '8',
    'IA1\n7', '6', '8', 'MP1\n7', 'ECO\n9', 'HMO\n5', ...optatives, '', ''];
  return [{ name: 'Taula 1', rows: [{ number: 1, cells: headers }, { number: 2, cells: row }] }];
}

test('keeps band grades and counts a repeated optative grade once', () => {
  const { students } = importAct(workbook(['OS11\n4', 'OS21\n6\nCED\n6', 'OS31\nNP\nIPO\nNP']));
  const student = students[0];
  const [first, second, third] = student.grades.filter(grade => grade.slot);
  assert.equal(first.value, 4);
  assert.equal(first.subject, '');
  assert.equal(second.subject, 'Comerç Electrònic');
  assert.equal(second.value, 6);
  assert.equal(third.special, 'NP');
  assert.deepEqual(totals(student), { count: 1, provisional: true, band: 1 });
  assert.equal(metrics([first, second, third]).n, 2);
});

test('leaves optatives with conflicting codes or duplicate grades unresolved', () => {
  const { students } = importAct(workbook(['OS11\n4\nFUEM\n5', 'OS21\n6\nCED\nCL\n5', 'OS31']));
  const optatives = students[0].grades.filter(grade => grade.slot);
  assert.deepEqual(optatives.map(grade => grade.state), ['review', 'review', 'missing']);
  assert.equal(optativeMappings(students).length, 0);
  assert.equal(metrics(optatives).n, 0);
});

test('recognizes IPO 1 as the confirmed IPO optative and validates the repeated grade', () => {
  const { students } = importAct(workbook(['OS11\n7\nIPO 1\n7', 'OS21\n8\nIPO 1\n9', 'OS31']));
  const [valid, conflict] = students[0].grades.filter(grade => grade.slot);
  assert.equal(valid.subject, 'Itinerari personal per a l’ocupabilitat');
  assert.equal(valid.subjectCode, 'IPO 1');
  assert.equal(valid.value, 7);
  assert.equal(conflict.state, 'review');
});

test('reads dash-separated marks and preserves missing or conflicting grades', () => {
  const book = workbook(['OS11 - 7\nODS - 7', 'OS21 – 8\nCFIS – 8', 'OS31 - 6\nIPO 1 - 7']);
  const cells = book[0].rows[1].cells;
  cells[7] = 'IA1 - 6';
  cells[11] = 'ECO -';
  cells[12] = 'HMO - PQ';
  const act = importAct(book);
  const grades = act.students[0].grades;
  assert.equal(grades.find(grade => grade.subjectCode === 'IA1').value, 6);
  assert.equal(grades.find(grade => grade.subjectCode === 'ECO').state, 'missing');
  assert.equal(grades.find(grade => grade.subjectCode === 'HMO').special, 'PQ');
  assert.equal(grades.find(grade => grade.slot === 1).subject, 'Objectius de Desenvolupament Sostenible');
  assert.equal(optativeMappings(act.students)[0].code, 'CFIS');
  assert.equal(grades.find(grade => grade.slot === 3).state, 'review');
});

test('reads an ungraded named optative when both dash-separated marks are blank', () => {
  const { students } = importAct(workbook(['OS11 -\nESEM -', 'OS21 - 8\nESEM - 8', 'OS31 -\nESEM - 6']));
  const [missing, valid, ambiguous] = students[0].grades.filter(grade => grade.slot);
  assert.equal(missing.subject, 'Estada a l’empresa');
  assert.equal(missing.state, 'missing');
  assert.equal(valid.subject, missing.subject);
  assert.equal(valid.value, 8);
  assert.equal(ambiguous.state, 'review');
});

test('keeps a matching band grade but does not choose between two optative codes', () => {
  const { students } = importAct(workbook(['OS11\n8', 'OS21\n7\nCED\nCL\n7', 'OS31\n9']));
  const grade = students[0].grades.find(grade => grade.slot === 2);
  assert.equal(grade.value, 7);
  assert.equal(grade.subject, '');
  assert.equal(grade.subjectReview, true);
  assert.equal(optativeMappings(students).length, 0);
  assert.equal(summarize(students).subjectRows.some(group => ['Comerç Electrònic', 'Creació literària'].includes(group.name)), false);
});

test('maps unknown optative codes without changing grades or assigning names to bare bands', () => {
  const book = workbook(['OS11\n4\nXYZ\n4', 'OS21\n6', 'OS31\n8'], { catalan: '0' });
  const hs = book[0].rows[1].cells;
  book[0].rows.push({ number: 3, cells: ['2', 'ID-SINTETIC-2', ...hs.slice(2)] });
  const ct = [...hs];
  ct[0] = '3';
  ct[1] = 'ID-SINTETIC-3';
  ct[3] = '2000';
  ct.splice(13, 3, 'OC11\n4\nXYZ\n4', 'OC21\n6', 'OC31\n8');
  book[0].rows.push({ number: 4, cells: ct });
  const { students } = importAct(book);
  const before = summarize(students);
  const mappings = optativeMappings(students);
  assert.equal(mappings.length, 2);
  const mapping = mappings.find(mapping => mapping.modality === '3000');
  assert.equal(mapping.grades.length, 2);
  assignSubject(mapping.grades, 'Creació literària');
  assert.equal(optativeMappings(students).length, 2);
  const bareBand = students[0].grades.find(grade => grade.slot === 2);
  assignSubject([bareBand], 'Comerç Electrònic');
  assert.equal(bareBand.subject, '');
  const after = summarize(students);
  assert.equal(after.n, before.n);
  assert.equal(after.failed, before.failed);
  assert.deepEqual(after.subjectRows.find(group => group.name === 'Creació literària').grades.map(g => g.value), [4, 4]);
  assert.equal(mapping.grades[0].raw, 'OS11\n4\nXYZ\n4');
  assert.equal(mapping.grades[0].origin, 'docent');
  assert.equal(after.grades.filter(hasUnnamedOptative).length, 7);
  assignSubject(mapping.grades, '');
  assert.equal(summarize(students).grades.filter(hasUnnamedOptative).length, 9);
});

test('excludes duplicate student identifiers from a multipage workbook', () => {
  const sheets = workbook(['OS11\n4', 'OS21\n6', 'OS31\n8']);
  sheets.push({ ...sheets[0], name: 'Taula 2' });
  const act = importAct(sheets);
  assert.equal(act.students.length, 1);
  assert.equal(act.rejected.length, 1);
});

test('keeps provisional students out of complete balances and counts valid band grades', () => {
  const patterns = [
    ['OS11\n5', 'OS21\n6', 'OS31\n7'],
    ['OS11\n4', 'OS21\n6', 'OS31\n3'],
    ['OS11\n4', 'OS21\n2', 'OS31\n3'],
    ['OS11\n5', 'OS21\nPQ', 'OS31\n7'],
  ];
  const sheets = patterns.map((optatives, i) => {
    const [sheet] = workbook(optatives);
    sheet.rows[1].cells[1] += i;
    return sheet;
  });
  const { students } = importAct(sheets);
  assert.deepEqual(students.map(student => balanceCategory(totals(student))), ['passed', 'some', 'many', 'provisional']);
  assert.deepEqual(summarize(students).balances, { passed: 1, some: 1, many: 1, provisional: 1 });
});

test('puts cutoffs in the higher interval and excludes special and missing grades', () => {
  const grades = [0, 3.99, 4, 4.99, 5, 6.99, 7, 8.99, 9, 10].map(value => ({ state: 'number', value }));
  grades.push({ state: 'special', value: null }, { state: 'review', value: null });
  assert.deepEqual(subjectDistribution(grades).map(bin => bin.count), [2, 2, 2, 2, 2]);
});

test('compares only students with one numeric grade in both subjects', () => {
  const mark = (subject, value, state = 'number') => ({ subject, value, state });
  const students = [
    { grades: [mark('Física', 4), mark('Química', 2)] },
    { grades: [mark('Física', 7), mark('Química', 4)] },
    { grades: [mark('Física', null, 'special'), mark('Química', 4)] },
    { grades: [mark('Física', 4), mark('Física', 2), mark('Química', 4)] },
  ];
  assert.deepEqual(subjectPairs(students, ['Física', 'Química'])[1][0], { n: 2, failed: 1 });
  assert.deepEqual(students.map(student => failedBoth(student, ['Física', 'Química'])), [true, false, false, false]);
});

test('attributes numeric failures to complete or provisional balances exactly once', () => {
  const patterns = [
    ['OS11\n4', 'OS21\n6', 'OS31\n3'],
    ['OS11\n4', 'OS21\n2', 'OS31\n3'],
    ['OS11\n4', 'OS21\nPQ', 'OS31\n7'],
  ];
  const sheets = patterns.map((optatives, i) => {
    const [sheet] = workbook(optatives);
    sheet.rows[1].cells[1] += i;
    return sheet;
  });
  assert.deepEqual(failureConcentration(importAct(sheets).students), { some: 2, many: 3, provisional: 1 });
});

test('imports a second-year workbook with a cover and a split additional-subject region', () => {
  const heading = [...secondHeaders.slice(0, -1), '', '', 'Altres', 'matèries', '', ''];
  heading[13] = 'Opt.';
  const row = ['1', 'ID-SINTETIC', 'Alumne de prova', '3000', '1', '6', '8', 'IA2\n7', '6', '8',
    'LL2\n7', 'EDN\n9', 'GEO\n5', 'OS12 - 4\nODS - 4', '8', '', 'LC1', 'LS1', '', '', ''];
  const act = importAct([
    { name: 'Portada', rows: [
      { number: 1, cells: ["Acta de qualificacions de l’avaluació parcial 1", 'Curs acadèmic 2024/2025'] },
      { number: 2, cells: ['BATXLOEM3000201', '26/11/2024'] },
    ] },
    { name: 'Taula 2', rows: [{ number: 1, cells: heading }, { number: 2, cells: row }] },
  ]);
  assert.equal(act.level, 2);
  assert.deepEqual(act.context, { year: '2024/2025', group: 'BATXLOEM3000201', period: 'Avaluació parcial 1', date: '2024-11-26' });
  assert.equal(act.rejected.length, 0);
  const grades = act.students[0].grades;
  assert.equal(grades.find(grade => grade.slot).value, 4);
  assert.equal(grades.find(grade => grade.subjectCode === 'IA2').subject, 'Llengua Estrangera II: Anglès');
  assert.equal(grades.find(grade => grade.subject === 'Treball de Recerca').value, 8);
  assert.deepEqual(grades.filter(grade => grade.column === 15).map(grade => [grade.subjectCode, grade.state]),
    [['LC1', 'missing'], ['LS1', 'missing']]);
});

test('finds reordered and optional columns by header and waits for unknown subject names', () => {
  const list = ['Treball de Recerca', 'Nom i cognoms', 'Ll. Cat.', 'Identificador', 'Matèria de prova', 'Opt.1'];
  const rows = [
    { number: 5, cells: list },
    { number: 6, cells: ['9', 'Alumne sintètic', '6', 'ID-1', '7', 'OS12\n8'] },
    { number: 7, cells: ['8', 'Alumna sintètica', '7', 'ID-2', '2\n9', 'OS12\n5'] },
  ];
  const act = importAct([{ name: 'Taula', rows }]);
  assert.equal(act.level, 2);
  assert.equal(act.students[0].ordinal, '1');
  assert.equal(act.students[0].grades.find(grade => grade.subject === 'Treball de Recerca').value, 9);
  assert.equal(act.students[0].grades.find(grade => grade.subject === 'Llengua Catalana i Literatura II').source, 'Taula!C6');
  assert.ok(!act.headers.includes('Ed. Fis.'));
  assert.equal(act.unresolved.length, 1);
  const [field] = act.unresolved;
  assert.equal(summarize(act.students).n, 6);
  assignColumn(field, 'Matèria confirmada');
  assert.deepEqual(field.grades.map(grade => grade.state), ['number', 'review']);
  assert.equal(summarize(act.students).n, 7);
  assignColumn(field, '');
  assert.equal(summarize(act.students).n, 6);
});

test('analyzes a student using one numeric grade per identified subject and comparable peers', () => {
  const grade = (subject, value, type = 'comuna', state = 'number') => ({ subject, value, type, state });
  const catalan = 'Llengua Catalana i Literatura I';
  const philosophy = 'Filosofia';
  const student = { grades: [
    grade(catalan, 8), grade(philosophy, 6), grade('Robòtica', 9, 'optativa'),
    grade('', 4, 'optativa'), grade('Educació Física', null, 'comuna', 'special'),
  ] };
  const group = [student,
    { grades: [grade(catalan, 6), grade(philosophy, 8), grade('Robòtica', 5, 'optativa')] },
    { grades: [grade(catalan, 5), grade(philosophy, 5), grade('Robòtica', 10, 'optativa'), grade('Robòtica', 7, 'optativa')] },
    { grades: [grade(catalan, 8)] },
  ];
  const report = studentAnalysis(student, group);
  assert.deepEqual(report.bins.map(bin => bin.count), [1, 1, 1, 1]);
  assert.deepEqual(report.domains.map(domain => [domain.name, domain.average]), [
    ['Lingüístic', 8], ['Humanístic', 6], ['Tecnològic', 9],
  ]);
  assert.deepEqual(report.comparisons.find(item => item.name === 'Robòtica'),
    { name: 'Robòtica', value: 9, average: 7, n: 2, delta: 2 });
  assert.ok(report.comparisons.every(item => item.name));
  assert.equal(report.percentile.n, 3);
  assert.equal(report.percentile.subjects, 2);
  assert.ok(Math.abs(report.percentile.percentile - 200 / 3) < 1e-9);
  assert.equal(report.notes.min, 4);
  assert.equal(report.notes.max, 9);
});

test('adds the artistic axis only when it has grades and keeps physical education outside the radar', () => {
  const student = { grades: [{ subject: 'Educació Física', state: 'number', value: 8 }] };
  assert.equal(studentAnalysis(student, [student]).domains.length, 0);
  student.grades.push({ subject: 'Comunicació Audiovisual', state: 'number', value: 7 });
  const report = studentAnalysis(student, [student]);
  assert.deepEqual(report.domains.map(domain => domain.name), ['Artístic']);
  assert.equal(report.notes.n, 2);
});
