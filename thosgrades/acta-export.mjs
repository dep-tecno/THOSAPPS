import { documentXml, studentRows, subjectRows, templateParts } from './acta-template.mjs';
import { metrics, subjectDistribution, summarize, totals } from './grades.mjs';

const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const encoder = new TextEncoder();
const format = new Intl.NumberFormat('ca', { maximumFractionDigits: 2 });
const percent = (value, count) => count ? `${format.format(100 * value / count)} %` : '—';
const ratio = (value, count) => count ? `${value} de ${count} (${percent(value, count)})` : '—';
const number = value => value == null ? '—' : format.format(value);

function escapeXml(value) {
  return String(value ?? '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/g, '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function fill(xml, values, sections = {}) {
  return xml.replace(/\{\{([A-Z0-9_]+)\}\}|<!--([A-Z_]+)-->/g, (match, key, section) =>
    key ? escapeXml(values[key]) : sections[section] ?? match);
}

function makeRows(patterns, key, rows) {
  return rows.map((row, i) => fill(patterns[i % patterns.length],
    Object.fromEntries(row.map((value, j) => [key + j, value])))).join('');
}

function balanceBar(counts, n) {
  const colors = ['306650', '346C7F', '81601C', '954C30', '535D74'];
  const width = 9354;
  let previous = 0;
  let cumulative = 0;
  const segments = counts.flatMap((count, i) => {
    cumulative += count;
    const end = Math.round(width * cumulative / n);
    const size = end - previous;
    previous = end;
    return size ? [{ size, color: colors[i] }] : [];
  });
  const grid = segments.map(({ size }) => `<w:gridCol w:w="${size}"/>`).join('');
  const cells = segments.map(({ size, color }) =>
    `<w:tc><w:tcPr><w:tcW w:w="${size}" w:type="dxa"/><w:shd w:fill="${color}"/></w:tcPr><w:p/></w:tc>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="${width}" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr>
    <w:tblGrid>${grid}</w:tblGrid><w:tr><w:trPr><w:trHeight w:val="270" w:hRule="exact"/></w:trPr>${cells}</w:tr></w:tbl>`;
}

function gradeLabel(grade) {
  return grade.subject || (grade.slot ? `Optativa de la franja ${grade.slot}` : grade.label);
}

export function actaXml(students, { context, subtitle, anonymize = false }) {
  if (!students.length) throw Error('No hi ha alumnes per incloure a l’acta.');
  const report = summarize(students);
  const n = students.length;
  const counts = [0, 0, 0, 0, 0];
  const individuals = students.map((student, index) => {
    const total = totals(student);
    const count = total.count;
    counts[total.provisional ? 4 : count === 0 ? 0 : count <= 2 ? 1 : count <= 4 ? 2 : 3]++;
    const label = !count && !total.provisional ? 'Tot aprovat' :
      count === 1 ? '1 matèria no superada' : `${count} matèries no superades`;
    const failed = student.grades.filter(grade => grade.state === 'number' && grade.value < 5).map(gradeLabel);
    return [anonymize ? `Alumne ${index + 1}` : student.name, [
      total.provisional ? `Provisional · ${label}` : label, failed.join(', '),
    ].filter(Boolean).join(' · ')];
  });
  const ranked = report.subjectRows.map(({ name, grades }) => ({ name, ...metrics(grades) }))
    .filter(row => row.failed)
    .sort((a, b) => b.failed - a.failed || b.failed / b.n - a.failed / a.n || a.name.localeCompare(b.name, 'ca'))
    .slice(0, 5)
    .map(row => [row.name, row.failed, row.n, percent(row.failed, row.n)]);
  const bins = subjectDistribution(report.grades);
  const missing = report.grades.filter(grade => grade.state === 'missing').length;
  const pending = report.grades.filter(grade => grade.special === 'PQ').length;
  const absent = report.grades.filter(grade => grade.special === 'NP').length;
  const review = report.grades.filter(grade => grade.state === 'review').length;
  const bandOnly = report.grades.filter(grade => grade.slot && grade.state === 'number' && !grade.subject).length;
  const causes = [[missing, 'sense nota'], [pending, 'pendents de qualificar'], [absent, 'no presentades'],
    [review, 'per revisar']].filter(([count]) => count).map(([count, label]) => `${count} ${label}`).join(', ');
  const date = context.date ? new Date(`${context.date}T00:00:00Z`) : null;
  const dateLabel = date && Number.isFinite(date.getTime()) ?
    new Intl.DateTimeFormat('ca', { dateStyle: 'long', timeZone: 'UTC' }).format(date) : '';
  const values = {
    SUBTITLE: subtitle,
    CONTEXT: [`Curs ${context.year?.trim() || '[pendent]'}`, `Grup ${context.group?.trim() || '[pendent]'}`,
      context.period?.trim() || 'Avaluació [pendent]', dateLabel || 'Data [pendent]'].join('  ·  '),
    SAMPLE: `${n} alumnes inclosos · ${report.n} notes numèriques`,
    OVERALL: `Aprovades ${ratio(report.passed, report.n)}  ·  Suspeses ${ratio(report.failed, report.n)}  ·  Mitjana ${number(report.average)}  ·  Mediana ${number(report.median)}`,
    PENDING: `${report.provisional} de ${n} alumnes amb balanç provisional.${causes ? ` Caselles pendents: ${causes}.` : ''}`,
    NEAR: report.failed ? `${bins[1].count} de les ${report.failed} notes suspeses (${percent(bins[1].count, report.failed)}) són entre 4 i menys de 5.` :
      'No hi ha notes numèriques suspeses.',
    BAND_NOTE: bandOnly ? `${bandOnly} notes d’optativa només identificades per franja. Compten en el balanç individual i queden fora del recompte per matèria.` : '',
  };
  counts.forEach((count, i) => { values[`BALANCE${i}`] = `${count} · ${percent(count, n)}`; });
  bins.forEach(({ count }, i) => { values[`BIN${i}`] = count; });
  return fill(documentXml, values, {
    BALANCE_BAR: balanceBar(counts, n),
    SUBJECT_ROWS: makeRows(subjectRows, 'SUBJECT', ranked.length ? ranked : [['Sense suspesos per matèria identificada', '—', '—', '—']]),
    STUDENT_ROWS: makeRows(studentRows, 'STUDENT', individuals),
  });
}

function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

function zip(parts) {
  const records = [];
  const headers = [];
  let offset = 0;
  let centralSize = 0;
  for (const { name, data, crc, size, method } of parts) {
    const file = encoder.encode(name);
    const local = new Uint8Array(30 + file.length);
    const a = new DataView(local.buffer);
    a.setUint32(0, 0x04034b50, true);
    a.setUint16(4, 20, true);
    a.setUint16(8, method, true);
    a.setUint16(12, 33, true);
    a.setUint32(14, crc, true);
    a.setUint32(18, data.length, true);
    a.setUint32(22, size, true);
    a.setUint16(26, file.length, true);
    local.set(file, 30);
    records.push(local, data);

    const central = new Uint8Array(46 + file.length);
    const b = new DataView(central.buffer);
    b.setUint32(0, 0x02014b50, true);
    b.setUint16(4, 20, true);
    b.setUint16(6, 20, true);
    central.set(local.subarray(6, 28), 8);
    b.setUint32(42, offset, true);
    central.set(file, 46);
    headers.push(central);
    centralSize += central.length;
    offset += local.length + data.length;
  }
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, parts.length, true);
  view.setUint16(10, parts.length, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, offset, true);
  return new Blob([...records, ...headers, end], { type: mime });
}

export function createActa(students, options) {
  const main = encoder.encode(actaXml(students, options));
  const staticParts = templateParts.map(([name, crc, size, payload]) => ({
    name, crc, size, method: 8, data: Uint8Array.from(atob(payload), char => char.charCodeAt(0)),
  }));
  return zip([...staticParts, { name: 'word/document.xml', crc: crc32(main), size: main.length, method: 0, data: main }]);
}
