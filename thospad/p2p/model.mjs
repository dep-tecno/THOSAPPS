import * as Y from 'yjs';

export function updateText(text, value) {
  const before = text.toString();
  if (before === value) return;
  let start = 0;
  while (start < before.length && start < value.length && before[start] === value[start]) start++;
  let end = 0;
  while (end < Math.min(before.length, value.length) - start &&
    before[before.length - 1 - end] === value[value.length - 1 - end]) end++;
  text.doc.transact(() => {
    const removed = before.length - start - end;
    if (removed) text.delete(start, removed);
    const inserted = value.slice(start, value.length - end);
    if (inserted) text.insert(start, inserted);
  });
}

export function addCard(cards, id, title = '', body = '') {
  const card = new Y.Map();
  card.set('title', new Y.Text(title));
  card.set('body', new Y.Text(body));
  cards.set(id, card);
}
