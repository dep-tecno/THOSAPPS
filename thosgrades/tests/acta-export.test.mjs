import assert from 'node:assert/strict';
import test from 'node:test';
import { actaXml, createActa } from '../acta-export.mjs';

const options = {
  context: { year: '2026–27', group: '2n CT & 2n HS', period: '1a avaluació', date: '2026-11-23' },
  subtitle: '2n de batxillerat',
};
const students = [
  { name: 'Cognom <Prova>', grades: [{ subject: 'Física II', state: 'number', value: 4 }] },
  { name: 'Segon Alumne', grades: [{ subject: 'Física II', state: 'number', value: 8 }] },
];

test('fills confirmed session data and complete statistics without leaving placeholders', () => {
  const xml = actaXml(students, options);
  assert.match(xml, /Curs 2026–27.*Grup 2n CT &amp; 2n HS.*23 de novembre del? 2026/);
  assert.match(xml, /Cognom &lt;Prova&gt;/);
  assert.match(xml, /1 matèria no superada · Física II/);
  assert.match(xml, /Aprovades 1 de 2 \(50 %\).*Mitjana 6/);
  assert.doesNotMatch(xml, /\{\{[A-Z0-9_]+\}\}/);
});

test('exports an anonymized copy only when requested', async () => {
  const copy = { ...options, anonymize: true };
  const xml = actaXml(students, copy);
  assert.match(xml, /Alumne 1/);
  assert.match(xml, /Alumne 2/);
  assert.doesNotMatch(xml, /Cognom|Segon Alumne/);
  const blob = createActa(students, copy);
  const data = new DataView(await blob.arrayBuffer());
  assert.equal(data.getUint32(0, true), 0x04034b50);
  assert.equal(data.getUint32(data.byteLength - 22, true), 0x06054b50);
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
});
