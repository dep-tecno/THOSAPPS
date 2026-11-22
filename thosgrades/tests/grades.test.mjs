import assert from 'node:assert/strict';
import test from 'node:test';
import { assignSubject, canAssign, headers, importAct, metrics, summarize, totals } from '../grades.mjs';

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
  assert.equal(optatives.some(canAssign), false);
  assert.equal(metrics(optatives).n, 0);
});

test('assigns a subject without changing the original grade or counting it twice', () => {
  const { students } = importAct(workbook(['OS11\n4', 'OS21\n6', 'OS31\n8'], { catalan: '0' }));
  const before = summarize(students);
  const pending = before.grades.filter(canAssign);
  assert.equal(pending.length, 3);
  assignSubject(pending.slice(0, 1), 'Creació literària');
  const after = summarize(students);
  assert.equal(after.n, before.n);
  assert.equal(after.failed, 2);
  assert.equal(after.subjectRows.find(group => group.name === 'Creació literària').grades[0].value, 4);
  assert.equal(pending[0].raw, 'OS11\n4');
  assert.equal(pending[0].origin, 'docent');
  assert.equal(after.grades.filter(canAssign).length, 2);
});

test('excludes duplicate student identifiers from a multipage workbook', () => {
  const sheets = workbook(['OS11\n4', 'OS21\n6', 'OS31\n8']);
  sheets.push({ ...sheets[0], name: 'Taula 2' });
  const act = importAct(sheets);
  assert.equal(act.students.length, 1);
  assert.equal(act.rejected.length, 1);
});
