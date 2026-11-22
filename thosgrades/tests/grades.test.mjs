import assert from 'node:assert/strict';
import test from 'node:test';
import { assignSubject, balanceCategory, hasUnnamedOptative, headers, importAct, metrics,
  optativeMappings, subjectDistribution, summarize, totals } from '../grades.mjs';

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
  const { students } = importAct(workbook(['OS11\n4\nFUEM\n5', 'OS21\n6\nCED\nCL\n6', 'OS31']));
  const optatives = students[0].grades.filter(grade => grade.slot);
  assert.deepEqual(optatives.map(grade => grade.state), ['review', 'review', 'missing']);
  assert.equal(optativeMappings(students).length, 0);
  assert.equal(metrics(optatives).n, 0);
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
