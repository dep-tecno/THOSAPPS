import { ZipReader, ZipWriter, Uint8ArrayReader, Uint8ArrayWriter, TextReader, TextWriter } from 'scribe.js-ocr/lib/zip.js/index.js';

function updateDimension(xml) {
  let firstRow = Infinity;
  let lastRow = 0;
  let firstColumn = '';
  let lastColumn = '';
  const sheetData = xml.match(/<sheetData>([\s\S]*?)<\/sheetData>/)?.[1] ?? '';
  for (const [, column, rowRef] of sheetData.matchAll(/<c\s+r="([A-Z]+)([1-9]\d*)"/g)) {
    const row = Number(rowRef);
    firstRow = Math.min(firstRow, row);
    lastRow = Math.max(lastRow, row);
    if (!firstColumn || column.length < firstColumn.length ||
        (column.length === firstColumn.length && column < firstColumn)) firstColumn = column;
    if (column.length > lastColumn.length ||
        (column.length === lastColumn.length && column > lastColumn)) lastColumn = column;
  }
  const first = lastRow ? firstColumn + firstRow : 'A1';
  const last = lastColumn + lastRow;
  const range = !lastRow || first === last ? first : `${first}:${last}`;
  return xml.replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="${range}"/>`);
}

export async function fixXlsxDimensions(bytes, { signal } = {}) {
  signal?.throwIfAborted();
  // Scribe.js 0.17.0 reuses a preamble with A1:B2 in both Excel modes.
  const source = new ZipReader(new Uint8ArrayReader(bytes));
  const target = new ZipWriter(new Uint8ArrayWriter());
  try {
    for (const entry of await source.getEntries()) {
      signal?.throwIfAborted();
      if (entry.directory) {
        await target.add(entry.filename, undefined, { directory: true });
      } else if (/^xl\/worksheets\/sheet\d+\.xml$/.test(entry.filename)) {
        const xml = await entry.getData(new TextWriter());
        await target.add(entry.filename, new TextReader(updateDimension(xml)));
      } else {
        const data = await entry.getData(new Uint8ArrayWriter());
        await target.add(entry.filename, new Uint8ArrayReader(data));
      }
    }
  } finally {
    await source.close();
  }
  const result = await target.close();
  signal?.throwIfAborted();
  return result;
}
