// THOSsCAN — capa d'exportació Word, 29/10/2026.
// Reutilitza les dades i el ZIP de Scribe.js 0.17.0 (scribeocr/scribe.js,
// GNU AGPL-3.0). No modifica el reconeixement ni l'exportador Excel.
import { Uint8ArrayWriter, Uint8ArrayReader, TextReader, ZipWriter } from 'scribe.js-ocr/lib/zip.js/index.js';
import ocr from 'scribe.js-ocr/js/objects/ocrObjects.js';
import { ca } from 'scribe.js-ocr/js/canvasAdapter.js';

const xml = value => String(value ?? '')
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const union = boxes => ({
  left: Math.min(...boxes.map(b => b.left)), top: Math.min(...boxes.map(b => b.top)),
  right: Math.max(...boxes.map(b => b.right)), bottom: Math.max(...boxes.map(b => b.bottom)),
});
const median = numbers => {
  const sorted = numbers.filter(n => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
};
const twips = (pixels, scale) => Math.max(0, Math.round(pixels * scale * 20));
// Yield between pages so the browser can handle Cancel and paint real progress.
async function checkpoint(signal) {
  signal?.throwIfAborted();
  await new Promise(resolve => setTimeout(resolve, 0));
  signal?.throwIfAborted();
}

// Recover only embedded picture regions, not whole scanned pages. Rendering
// each source page once preserves PDF clipping, rotation, masks and paint order.
// The rest of the document still exports as editable text and tables.
export async function collectWordImages(doc, { signal, onProgress } = {}) {
  const pages = new Map();
  if (!doc.inputData.pdfMode) return pages;
  let serial = 0;
  for (let n = 0; n < doc.pageMetrics.length; n++) {
    await checkpoint(signal);
    const dims = doc.pageMetrics[n].dims;
    const seen = new Set();
    const regions = (doc.fillShapes?.pages[n]?.images || []).map(image => ({
      left: Math.max(0, image.left), top: Math.max(0, image.top),
      right: Math.min(dims.width, image.right), bottom: Math.min(dims.height, image.bottom),
    })).filter(box => {
      if (!Object.values(box).every(Number.isFinite)) return false;
      const area = (box.right - box.left) * (box.bottom - box.top);
      if (box.right <= box.left || box.bottom <= box.top || area >= dims.width * dims.height * 0.8) return false;
      const key = Object.values(box).map(Math.round).join(':');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (!regions.length) {
      onProgress?.({ stage: 'images', completed: n + 1, total: doc.pageMetrics.length });
      continue;
    }
    const rendered = await doc.images.renderPageImage(n, { dpi: 150, format: 'png', colorMode: 'color' });
    signal?.throwIfAborted();
    if (!rendered.ok || !rendered.dataUrl) {
      throw new Error(`No s'han pogut recuperar les imatges de la pàgina ${n + 1}: ${rendered.failDetail || rendered.failReason || 'renderització fallida'}`);
    }
    const bitmap = await ca.getImageBitmap(rendered.dataUrl);
    try {
      for (const bbox of regions) {
        await checkpoint(signal);
        const x = Math.max(0, Math.floor(bbox.left / dims.width * bitmap.width));
        const y = Math.max(0, Math.floor(bbox.top / dims.height * bitmap.height));
        const right = Math.min(bitmap.width, Math.ceil(bbox.right / dims.width * bitmap.width));
        const bottom = Math.min(bitmap.height, Math.ceil(bbox.bottom / dims.height * bitmap.height));
        const canvas = await ca.createCanvas(Math.max(1, right - x), Math.max(1, bottom - y));
        try {
          const ctx = canvas.getContext('2d');
          ctx.drawImage(bitmap, x, y, right - x, bottom - y, 0, 0, canvas.width, canvas.height);
          // Some PDF producers paint a hidden/repeated logo behind an opaque
          // background. Do not resurrect it or add a white picture to Word.
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let visible = false;
          for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i + 3] > 5 && Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) < 250) { visible = true; break; }
          }
          if (!visible) continue;
          const blob = await canvas.convertToBlob({ type: 'image/png', mime: 'image/png' });
          const id = ++serial;
          const image = { kind: 'image', bbox, id, relationship: `rIdImage${id}`,
            filename: `image-${id}.png`, bytes: new Uint8Array(await blob.arrayBuffer()) };
          if (!pages.has(n)) pages.set(n, []);
          pages.get(n).push(image);
        } finally { ca.closeDrawable(canvas); }
      }
    } finally { ca.closeDrawable(bitmap); }
    onProgress?.({ stage: 'images', completed: n + 1, total: doc.pageMetrics.length });
  }
  return pages;
}

const insideImage = (word, image) => {
  const a = word.bbox, b = image.bbox;
  const overlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
    * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return overlap > Math.max(1, (a.right - a.left) * (a.bottom - a.top)) * 0.6;
};

// Table extraction returns cloned words. Match by stable id to avoid also
// exporting the same text as body paragraphs; never discard text by bbox alone.
export function buildWordPages(doc, scribe, imagePages = new Map()) {
  return doc.pageMetrics.map((metrics, n) => {
    const page = doc.ocr.active[n] || { dims: metrics.dims, lines: [] };
    const images = imagePages.get(n) || [];
    const consumed = new Set(page.lines.flatMap(line => line.words)
      .filter(word => images.some(image => insideImage(word, image))).map(word => word.id));
    const tables = [];
    for (const table of doc.layoutDataTables.pages[n]?.tables ?? []) {
      const columns = [...table.boxes].sort((a, b) => a.coords.left - b.coords.left);
      if (columns.length < 2) continue;
      const extracted = scribe.utils.extractSingleTableContent(page, columns, table.rowBounds);
      extracted.rowWordArr = extracted.rowWordArr.map(row => row.map(cell => cell.filter(word => !images.some(image => insideImage(word, image)))));
      if (!extracted.rowWordArr.some(row => row.some(cell => cell.length))) continue;
      // Ignore overlapping candidate tables instead of duplicating their words.
      const words = extracted.rowWordArr.flat(2);
      if (words.some(word => consumed.has(word.id))) continue;
      words.forEach(word => consumed.add(word.id));
      tables.push({
        kind: 'table', bbox: union(columns.map(col => col.coords)), columns,
        rows: extracted.rowWordArr, rowBounds: extracted.rowBottomArr,
        headerRows: table.headerRows ?? 1, bandColor: table.bandColor,
      });
    }
    const blocks = [...tables, ...images];
    let current = null;
    for (const line of page.lines) {
      const words = line.words.filter(word => !consumed.has(word.id));
      if (!words.length) { current = null; continue; }
      const bbox = union(words.map(word => word.bbox));
      const separatedByTable = current && [...tables, ...images].some(table =>
        table.bbox.top >= current.bbox.bottom && table.bbox.bottom <= bbox.top);
      if (!current || !line.par || current.par !== line.par || separatedByTable) {
        current = { kind: 'paragraph', par: line.par, lines: [], bbox };
        blocks.push(current);
      }
      current.lines.push({ words, bbox });
      current.bbox = union([current.bbox, bbox]);
    }
    blocks.sort((a, b) => a.bbox.top - b.bbox.top || a.bbox.left - b.bbox.left);
    return { n, dims: page.dims, blocks };
  });
}

function run(text, style, scale, defaultSize) {
  const size = Math.max(8, Math.min(192, Math.round((style.size ? style.size * scale : defaultSize) * 2)));
  const color = /^#[0-9a-f]{6}$/i.test(style.color) ? style.color.slice(1) : '000000';
  let properties = `<w:rFonts w:ascii="${xml(style.font || 'Times New Roman')}" w:hAnsi="${xml(style.font || 'Times New Roman')}"/>`;
  if (style.bold) properties += '<w:b/>';
  if (style.italic) properties += '<w:i/>';
  if (style.smallCaps) properties += '<w:smallCaps/>';
  properties += `<w:color w:val="${color}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`;
  if (style.underline) properties += '<w:u w:val="single"/>';
  if (style.sup) properties += '<w:vertAlign w:val="superscript"/>';
  return `<w:r><w:rPr>${properties}</w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
}

function wordsXml(words, scale, defaultSize) {
  return words.map((word, i) => {
    const segments = ocr.getWordStyleSegments(word) || [{ start: 0, end: word.text.length, style: word.style }];
    return segments.map((segment, j) => run(
      (i && !j && !word.style.sup ? ' ' : '') + word.text.slice(segment.start, segment.end),
      segment.style, scale, defaultSize,
    )).join('');
  }).join('');
}

// Preserve the reading order of multi-line cells (sorting only by x would
// interleave the words on different lines of the same cell).
function cellLines(words) {
  const lines = [];
  for (const word of [...words].sort((a, b) => a.bbox.top - b.bbox.top || a.bbox.left - b.bbox.left)) {
    let line = lines.find(candidate => {
      const overlap = Math.min(candidate.bbox.bottom, word.bbox.bottom) - Math.max(candidate.bbox.top, word.bbox.top);
      const height = Math.min(candidate.bbox.bottom - candidate.bbox.top, word.bbox.bottom - word.bbox.top);
      return overlap > height * 0.5;
    });
    if (!line) { line = { words: [], bbox: word.bbox }; lines.push(line); }
    line.words.push(word);
    line.bbox = union([line.bbox, word.bbox]);
  }
  lines.forEach(line => line.words.sort((a, b) => a.bbox.left - b.bbox.left));
  return lines;
}

function paragraphXml(block, context, before) {
  const { scale, defaultSize, left, right } = context;
  const indent = twips(Math.max(0, block.bbox.left - left), scale);
  const rightIndent = twips(Math.max(0, right - block.bbox.right), scale);
  const sizePx = defaultSize / scale;
  const gaps = block.lines.slice(1).map((line, i) => line.bbox.top - block.lines[i].bbox.top);
  const lineHeight = Math.max(defaultSize * 1.05, (median(gaps) || sizePx * 1.15) * scale);
  let props = `<w:spacing w:before="${twips(before, scale)}" w:after="0" w:line="${Math.round(lineHeight * 20)}" w:lineRule="atLeast"/>`;
  props += `<w:ind w:left="${indent}" w:right="${rightIndent}"/>`;
  if (block.par?.type === 'title') props += `<w:outlineLvl w:val="${Math.max(0, Math.min(8, (block.par.headingLevel || 1) - 1))}"/>`;
  const content = block.lines.map((line, i) => (i ? '<w:r><w:br/></w:r>' : '') + wordsXml(line.words, scale, defaultSize)).join('');
  return `<w:p><w:pPr>${props}</w:pPr>${content}</w:p>`;
}

function tableXml(table, context) {
  const { scale, left, defaultSize } = context;
  const widths = table.columns.map(col => twips(col.coords.right - col.coords.left, scale));
  const width = widths.reduce((sum, value) => sum + value, 0);
  const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(edge =>
    `<w:${edge} w:val="single" w:sz="4" w:color="BFBFBF"/>`).join('');
  let result = `<w:tbl><w:tblPr><w:tblW w:w="${width}" w:type="dxa"/><w:tblInd w:w="${twips(Math.max(0, table.bbox.left - left), scale)}" w:type="dxa"/><w:tblBorders>${borders}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="50" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="50" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>`;
  result += `<w:tblGrid>${widths.map(width => `<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>`;
  table.rows.forEach((row, r) => {
    const rowTop = r ? table.rowBounds[r - 1] : table.bbox.top;
    const height = twips(Math.max(0, table.rowBounds[r] - rowTop), scale);
    result += `<w:tr><w:trPr>${r < table.headerRows ? '<w:tblHeader/>' : ''}<w:trHeight w:val="${height}" w:hRule="atLeast"/></w:trPr>`;
    for (let c = 0; c < widths.length; c++) {
      let properties = `<w:tcW w:w="${widths[c]}" w:type="dxa"/><w:vAlign w:val="top"/>`;
      if (r >= table.headerRows && r % 2 && /^#[0-9a-f]{6}$/i.test(table.bandColor)) {
        properties = `<w:tcW w:w="${widths[c]}" w:type="dxa"/><w:shd w:val="clear" w:fill="${table.bandColor.slice(1)}"/><w:vAlign w:val="top"/>`;
      }
      const lines = cellLines(row[c] || []);
      const content = lines.map((line, i) => (i ? '<w:r><w:br/></w:r>' : '') + wordsXml(line.words, scale, defaultSize)).join('');
      result += `<w:tc><w:tcPr>${properties}</w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>${content}</w:p></w:tc>`;
    }
    result += '</w:tr>';
  });
  // Word requires a paragraph after a table, also separating adjacent tables.
  return result + '</w:tbl><w:p><w:pPr><w:spacing w:after="0" w:line="20" w:lineRule="exact"/></w:pPr><w:r><w:rPr><w:sz w:val="2"/></w:rPr><w:t/></w:r></w:p>';
}

function imageXml(image, context, before) {
  const { scale, left } = context;
  const cx = Math.max(1, Math.round((image.bbox.right - image.bbox.left) * scale * 12700));
  const cy = Math.max(1, Math.round((image.bbox.bottom - image.bbox.top) * scale * 12700));
  const indent = twips(Math.max(0, image.bbox.left - left), scale);
  return `<w:p><w:pPr><w:spacing w:before="${twips(before, scale)}" w:after="0"/><w:ind w:left="${indent}"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${image.id}" name="Imatge ${image.id}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${image.id}" name="${image.filename}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${image.relationship}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

function pageXml(page, isPdf) {
  if (!page.blocks.length) return '';
  const allWords = page.blocks.flatMap(block => block.kind === 'table' ? block.rows.flat(2) : block.kind === 'paragraph' ? block.lines.flatMap(line => line.words) : []);
  // PDF geometry is expressed at 300 dpi by Scribe.js. Fit image inputs onto
  // an A4 page without changing their aspect ratio or assuming their scan DPI.
  const scale = isPdf ? 72 / 300 : Math.min(595.28 / page.dims.width, 841.89 / page.dims.height);
  const bounds = union(page.blocks.map(block => block.bbox));
  const left = Math.max(0, bounds.left), right = Math.min(page.dims.width, bounds.right);
  const context = { scale, left, right, defaultSize: median(allWords.map(word => word.style.size)) * scale || 11 };
  let body = '';
  let previousBottom = bounds.top;
  for (const block of page.blocks) {
    const gap = Math.max(0, block.bbox.top - previousBottom);
    if (block.kind === 'table') {
      if (gap) body += `<w:p><w:pPr><w:spacing w:after="0" w:line="${Math.max(20, twips(gap, scale))}" w:lineRule="exact"/></w:pPr></w:p>`;
      body += tableXml(block, context);
    } else if (block.kind === 'image') body += imageXml(block, context, gap);
    else body += paragraphXml(block, context, gap);
    previousBottom = Math.max(previousBottom, block.bbox.bottom);
  }
  return { body, section: `<w:sectPr><w:type w:val="nextPage"/><w:pgSz w:w="${twips(page.dims.width, scale)}" w:h="${twips(page.dims.height, scale)}"/><w:pgMar w:top="${twips(Math.max(0, bounds.top), scale)}" w:right="${twips(Math.max(0, page.dims.width - right), scale)}" w:bottom="${twips(Math.max(0, page.dims.height - bounds.bottom), scale)}" w:left="${twips(left, scale)}" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>` };
}

export async function exportWord(doc, scribe, { signal, onProgress } = {}) {
  await checkpoint(signal);
  const imagePages = await collectWordImages(doc, { signal, onProgress });
  signal?.throwIfAborted();
  const pages = buildWordPages(doc, scribe, imagePages);
  let body = '';
  for (let i = 0; i < pages.length; i++) {
    await checkpoint(signal);
    const page = pages[i];
    const output = pageXml(page, doc.inputData.pdfMode);
    if (!output) {
      body += '<w:p>' + (i < pages.length - 1 ? '<w:r><w:br w:type="page"/></w:r>' : '') + '</w:p>';
    } else {
      body += output.body;
      body += i === pages.length - 1 ? output.section : `<w:p><w:pPr>${output.section}</w:pPr></w:p>`;
    }
    onProgress?.({ stage: 'pages', completed: i + 1, total: pages.length });
  }
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body}</w:body></w:document>`;
  const writer = new Uint8ArrayWriter();
  const zip = new ZipWriter(writer);
  const files = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/_rels/document.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'word/styles.xml': '<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>',
    'word/document.xml': document,
  };
  const images = [...imagePages.values()].flat();
  files['[Content_Types].xml'] = files['[Content_Types].xml'].replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>');
  const relationships = images.map(image => `<Relationship Id="${image.relationship}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${image.filename}"/>`).join('');
  files['word/_rels/document.xml.rels'] = files['word/_rels/document.xml.rels'].replace('</Relationships>', relationships + '</Relationships>');
  onProgress?.({ stage: 'packaging' });
  let closed = false;
  try {
    for (const [name, content] of Object.entries(files)) {
      signal?.throwIfAborted();
      await zip.add(name, new TextReader(content), { signal });
    }
    for (const image of images) {
      signal?.throwIfAborted();
      await zip.add(`word/media/${image.filename}`, new Uint8ArrayReader(image.bytes), { signal });
    }
    signal?.throwIfAborted();
    await zip.close();
    closed = true;
    signal?.throwIfAborted();
    return writer.getData();
  } finally {
    if (!closed) await zip.close().catch(() => {});
  }
}

