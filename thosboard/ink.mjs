const NS = 'http://www.w3.org/2000/svg';

export function createInk(el, changed) {
  const layer = el('ink');
  const picker = el('ink-color');
  const palette = el('ink-palette');
  const undo = el('undo-ink');
  const colors = { write: '#155ad4', highlight: '#ffe34c' };
  const swatches = [
    ['Negre', '#000000'], ['Blanc', '#ffffff'], ['Vermell', '#e32636'], ['Blau', '#155ad4'],
    ['Verd', '#27a844'], ['Groc', '#ffe34c'], ['Taronja', '#ff8c00'], ['Violeta', '#8b42cc'],
  ];
  let tool;
  let strokes = [];
  let active;
  let penSeen = false;

  function draw(stroke) {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', stroke.path);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', stroke.color);
    path.setAttribute('stroke-width', stroke.tool === 'highlight' ? '11' : '2.5');
    path.setAttribute('stroke-opacity', stroke.tool === 'highlight' ? '.35' : '1');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    layer.append(path);
    return path;
  }

  function report() {
    const current = active?.stroke;
    changed(strokes, current);
  }

  function point(event) {
    const matrix = layer.getScreenCTM();
    if (!matrix) return;
    const { x, y } = new DOMPoint(event.clientX, event.clientY)
      .matrixTransform(matrix.inverse());
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const box = layer.viewBox.baseVal;
    return [Math.round(Math.max(0, Math.min(box.width, x))), Math.round(Math.max(0, Math.min(box.height, y)))];
  }

  for (const name of Object.keys(colors)) {
    el(name).onclick = () => select(tool === name ? undefined : name);
  }

  function select(name) {
    tool = name;
    for (const option of Object.keys(colors)) el(option).setAttribute('aria-pressed', String(option === tool));
    el('stage').classList.toggle('inking', Boolean(tool));
    picker.hidden = !tool;
    closePalette();
    if (tool) updateColor();
  }

  function closePalette() {
    palette.hidden = true;
    picker.setAttribute('aria-expanded', 'false');
  }

  function updateColor() {
    const color = colors[tool];
    picker.style.setProperty('--swatch', color);
    picker.setAttribute('aria-label', 'Tria el color de l’eina. Color actual: ' + swatches.find(([, value]) => value === color)[0]);
    for (const button of palette.children) {
      button.setAttribute('aria-pressed', String(button.value === color));
    }
  }

  for (const [name, color] of swatches) {
    const button = document.createElement('button');
    const sample = document.createElement('span');
    button.type = 'button';
    button.value = color;
    button.title = name;
    button.setAttribute('aria-label', name);
    button.style.setProperty('--swatch', color);
    button.append(sample);
    button.onclick = () => {
      colors[tool] = color;
      updateColor();
      closePalette();
      picker.focus();
    };
    palette.append(button);
  }

  picker.onclick = () => {
    if (!palette.hidden) return closePalette();
    palette.hidden = false;
    const anchor = picker.getBoundingClientRect();
    palette.style.top = anchor.bottom + 6 + 'px';
    palette.style.left = Math.max(4, Math.min(anchor.left, document.documentElement.clientWidth - palette.offsetWidth - 4)) + 'px';
    picker.setAttribute('aria-expanded', 'true');
    palette.querySelector('[aria-pressed="true"]')?.focus();
  };

  document.addEventListener('click', event => {
    if (!palette.contains(event.target) && !picker.contains(event.target)) closePalette();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || palette.hidden) return;
    closePalette();
    picker.focus();
  });
  window.addEventListener('resize', closePalette);
  undo.onclick = () => {
    if (active || !strokes.length) return;
    strokes = strokes.slice(0, -1);
    layer.lastChild?.remove();
    undo.disabled = !strokes.length;
    report();
  };

  return {
    get enabled() { return Boolean(tool); },
    get fingerDrawing() { return Boolean(tool) && !penSeen; },
    get pointer() { return active?.id; },
    select,
    layout(page, width, height) {
      layer.removeAttribute('hidden');
      layer.setAttribute('viewBox', `0 0 ${width * 1000 / height} 1000`);
      layer.style.width = page.style.width;
      layer.style.height = page.style.height;
      layer.style.transform = page.style.transform;
    },
    show(next = [], preview) {
      active = undefined;
      strokes = next;
      layer.replaceChildren();
      for (const stroke of strokes) draw(stroke);
      if (preview) draw(preview);
      undo.disabled = !strokes.length;
    },
    clear() {
      closePalette();
      this.show();
      layer.setAttribute('hidden', '');
    },
    start(event) {
      if (event.pointerType === 'pen') penSeen = true;
      const location = point(event);
      if (!location) return;
      const [x, y] = location;
      const stroke = { tool, color: colors[tool], path: `M${x},${y}l0,.01` };
      active = { id: event.pointerId, stroke, node: draw(stroke), x, y };
      report();
    },
    move(event) {
      const samples = event.getCoalescedEvents?.();
      for (const sample of samples?.length ? samples : [event]) {
        if (active.stroke.path.length >= 12000) break;
        const location = point(sample);
        if (!location) continue;
        const [x, y] = location;
        if (x === active.x && y === active.y) continue;
        active.stroke.path += `L${x},${y}`;
        active.x = x;
        active.y = y;
      }
      active.node.setAttribute('d', active.stroke.path);
      report();
    },
    finish(keep) {
      if (!active) return;
      if (keep) strokes = [...strokes, active.stroke];
      else active.node.remove();
      active = undefined;
      undo.disabled = !strokes.length;
      report();
    },
  };
}
