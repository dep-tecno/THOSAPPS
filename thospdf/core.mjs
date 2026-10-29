export function parsePages(value, count) {
  if (!value.trim()) throw new Error('Indica les pàgines que vols extreure.');
  const pages = new Set();
  for (const token of value.split(',')) {
    const match = token.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error('Format incorrecte. Exemple vàlid: 1-3, 5, 8-10.');
    const start = Number(match[1]), end = Number(match[2] ?? match[1]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end > count || start > end) throw new Error(`Les pàgines han d’estar entre 1 i ${count}, amb intervals creixents.`);
    for (let page = start; page <= end; page++) pages.add(page - 1);
  }
  return [...pages];
}
export async function copyDocuments(PDFDocument, sources) {
  const output = await PDFDocument.create();
  for (const {doc, pages = doc.getPageIndices()} of sources) {
    const copies = await output.copyPages(doc, pages);
    for (const page of copies) output.addPage(page);
  }
  if (!output.getPageCount()) throw new Error('El resultat no conté cap pàgina.');
  return output.save();
}
export function pdfName(value) {
  const name = value.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/, '') || 'document';
  return /\.pdf$/i.test(name) ? name : `${name}.pdf`;
}
