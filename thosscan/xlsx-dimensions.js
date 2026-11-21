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

function wrapCellStyles(xml) {
  return xml.replace(/<cellXfs\b[^>]*>[\s\S]*?<\/cellXfs>/, styles =>
    styles.replace(/<xf\b([^>]*?)(?:\/>|>([\s\S]*?)<\/xf>)/g, (_, attrs, content = '') => {
      const attributes = attrs.replace(/ applyAlignment="[^"]*"/, '');
      const alignment = /<alignment\b[^>]*\/>/;
      const body = alignment.test(content)
        ? content.replace(alignment, tag => tag.replace(/\/>$/, ' wrapText="1"/>'))
        : '<alignment wrapText="1"/>' + content;
      return `<xf${attributes} applyAlignment="1">${body}</xf>`;
    }));
}

export async function fixXlsxDimensions(bytes, { signal, rowHeights } = {}) {
  signal?.throwIfAborted();
  // Scribe.js 0.17.0 reuses a preamble with A1:B2 in both Excel modes.
  const source = new ZipReader(new Uint8ArrayReader(bytes));
  const target = new ZipWriter(new Uint8ArrayWriter());
  try {
    for (const entry of await source.getEntries()) {
      signal?.throwIfAborted();
      if (entry.directory) {
        await target.add(entry.filename, undefined, { directory: true });
      } else if (entry.filename === 'xl/styles.xml' && rowHeights) {
        const xml = await entry.getData(new TextWriter());
        await target.add(entry.filename, new TextReader(wrapCellStyles(xml)));
      } else if (/^xl\/worksheets\/sheet\d+\.xml$/.test(entry.filename)) {
        const xml = await entry.getData(new TextWriter());
        const sheetIndex = Number(entry.filename.match(/sheet(\d+)\.xml$/)[1]) - 1;
        const heights = rowHeights?.[sheetIndex];
        const sheet = heights ? xml.replace(/<row r="(\d+)">/g, (tag, row) => {
          const height = heights[Number(row) - 1];
          return height > 15 ? `<row r="${row}" ht="${height}" customHeight="1">` : tag;
        }) : xml;
        await target.add(entry.filename, new TextReader(updateDimension(sheet)));
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
