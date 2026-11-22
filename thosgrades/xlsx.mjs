const XML_LIMIT = 12 * 1024 * 1024;
const utf8 = new TextDecoder();

// Read only the ZIP members needed for an OOXML workbook.
function openArchive(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let end = bytes.length - 22;
  const minimum = Math.max(0, end - 65535);
  while (end >= minimum && (view.getUint32(end, true) !== 0x06054b50 ||
    end + 22 + view.getUint16(end + 20, true) !== bytes.length)) end--;
  if (end < minimum || view.getUint32(end + 4, true) !== 0) throw Error('El fitxer no és un XLSX compatible.');
  const count = view.getUint16(end + 10, true);
  if (count > 2048) throw Error('El llibre té massa elements interns.');
  const entries = new Map();
  let offset = view.getUint32(end + 16, true);
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) throw Error('El llibre està malmès.');
    const nameLength = view.getUint16(offset + 28, true);
    const name = utf8.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    entries.set(name, {
      method: view.getUint16(offset + 10, true),
      size: view.getUint32(offset + 24, true),
      packed: view.getUint32(offset + 20, true),
      local: view.getUint32(offset + 42, true),
    });
    offset += 46 + nameLength + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
  let remaining = XML_LIMIT;
  return async function read(name) {
    const entry = entries.get(name);
    if (!entry) return null;
    const { local, size, packed, method } = entry;
    if (size > remaining || local + 30 > end || view.getUint32(local, true) !== 0x04034b50) {
      throw Error('El llibre supera el límit de lectura o està malmès.');
    }
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    if (start + packed > end || ![0, 8].includes(method)) throw Error('Compressió XLSX incompatible.');
    const data = bytes.subarray(start, start + packed);
    const reader = new Blob([data]).stream();
    const stream = method === 8 ? reader.pipeThrough(new DecompressionStream('deflate-raw')) : reader;
    const decoder = new TextDecoder();
    let output = '';
    let readBytes = 0;
    const parts = stream.getReader();
    try {
      while (true) {
        const { done, value } = await parts.read();
        if (done) break;
        readBytes += value.byteLength;
        if (readBytes > size) {
          await parts.cancel();
          throw Error('La mida de les dades del llibre no és vàlida.');
        }
        output += decoder.decode(value, { stream: true });
      }
    } finally {
      parts.releaseLock();
    }
    if (readBytes !== size) throw Error('El llibre està incomplet.');
    remaining -= size;
    return output + decoder.decode();
  };
}

function browserXml(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw Error('El llibre conté XML malmès.');
  function convert(element) {
    return {
      name: element.localName,
      attrs: Object.fromEntries([...element.attributes].map(attr => [attr.name, attr.value])),
      text: element.textContent,
      children: [...element.children].map(convert),
    };
  }
  return convert(doc.documentElement);
}

const child = (node, name) => node?.children.find(part => part.name === name);
const children = (node, name) => node?.children.filter(part => part.name === name) ?? [];
const richText = node => (child(node, 't')?.text ??
  children(node, 'r').map(run => child(run, 't')?.text ?? '').join(''));

function workbookPath(target) {
  const parts = target.startsWith('/') ? [] : ['xl'];
  for (const part of target.split('/')) {
    if (part === '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  }
  return parts.join('/');
}

export async function readWorkbook(buffer, parseXml = browserXml) {
  const read = openArchive(buffer);
  async function xml(path) {
    const source = await read(path);
    if (!source) return null;
    if (/<!DOCTYPE/i.test(source)) throw Error('El llibre conté una definició XML incompatible.');
    return parseXml(source);
  }
  const book = await xml('xl/workbook.xml');
  const relations = await xml('xl/_rels/workbook.xml.rels');
  const sheets = children(child(book, 'sheets'), 'sheet');
  if (!relations || !sheets.length || sheets.length > 100) throw Error('No hi ha fulls XLSX compatibles.');
  const links = new Map(children(relations, 'Relationship')
    .filter(node => node.attrs.TargetMode !== 'External')
    .map(node => [node.attrs.Id, node.attrs.Target]));
  const strings = children(await xml('xl/sharedStrings.xml'), 'si').map(richText);
  const result = [];
  for (const sheet of sheets) {
    const target = links.get(sheet.attrs['r:id']);
    const data = target && child(await xml(workbookPath(target)), 'sheetData');
    if (!data) throw Error('Hi ha un full que no es pot llegir.');
    const rows = children(data, 'row').map(row => {
      const cells = [];
      for (const cell of children(row, 'c')) {
        const address = /^([A-Z]{1,3})(\d+)$/.exec(cell.attrs.r ?? '');
        if (!address) throw Error('El llibre conté una adreça de cel·la invàlida.');
        const index = [...address[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
        const value = child(cell, 'v')?.text ?? '';
        cells[index] = cell.attrs.t === 'inlineStr' ? richText(child(cell, 'is')) :
          cell.attrs.t === 's' ? strings[Number(value)] ?? '' : value;
      }
      return { number: Number(row.attrs.r), cells };
    });
    result.push({ name: sheet.attrs.name, rows });
  }
  return result;
}
