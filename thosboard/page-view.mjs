export function createPageView(el, changed, ink) {
  const stage = el('stage');
  const tools = el('view-tools');
  const pan = el('pan');
  let page;
  let zoom = 1;
  let rotation = 0;
  let x = 0;
  let y = 0;
  let drag;
  let remoteView;
  let lastView;
  const touches = new Map();

  function touchPosition() {
    const [first, second] = touches.values();
    if (!second) return { ...first, distance: 0 };
    return {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
      distance: Math.hypot(first.x - second.x, first.y - second.y),
    };
  }

  function clearTouches() {
    const ids = [...touches.keys()];
    touches.clear();
    for (const id of ids) {
      if (stage.hasPointerCapture(id)) stage.releasePointerCapture(id);
    }
  }

  function update() {
    if (!page) return;
    const width = page.naturalWidth ?? page.width;
    const height = page.naturalHeight ?? page.height;
    if (!width || !height) return;
    const turned = rotation % 180 !== 0;
    const availableWidth = Math.max(0, stage.clientWidth - 12);
    const availableHeight = Math.max(0, stage.clientHeight - 12);
    const horizontal = turned ? height : width;
    const vertical = turned ? width : height;
    const scale = zoom * Math.min(availableWidth / horizontal, availableHeight / vertical);
    const limitX = Math.max(0, (horizontal * scale - availableWidth) / 2);
    const limitY = Math.max(0, (vertical * scale - availableHeight) / 2);
    if (!scale) return;
    if (remoteView) {
      x = remoteView.x * horizontal * scale;
      y = remoteView.y * vertical * scale;
    } else {
      x = Math.max(-limitX, Math.min(limitX, x));
      y = Math.max(-limitY, Math.min(limitY, y));
      const next = { zoom, rotation, x: x / (horizontal * scale), y: y / (vertical * scale) };
      if (!lastView || Object.keys(next).some(key => next[key] !== lastView[key])) {
        lastView = next;
        changed(next);
      }
    }
    page.style.width = width * scale + 'px';
    page.style.height = height * scale + 'px';
    page.style.transform = 'translate(-50%, -50%) translate(' + x + 'px, ' + y + 'px) rotate(' + rotation + 'deg)';
    ink.layout(page, width, height);
    el('zoom-out').disabled = zoom === 1;
    el('zoom-in').disabled = zoom === 4;
  }

  function endDrag() {
    if (drag && stage.hasPointerCapture(drag.id)) stage.releasePointerCapture(drag.id);
    drag = undefined;
    stage.classList.remove('dragging');
  }

  function reset() {
    clearTouches();
    zoom = 1;
    x = y = 0;
    endDrag();
    update();
  }

  function togglePan(active) {
    pan.setAttribute('aria-pressed', String(active));
    stage.classList.toggle('pan', active);
    if (!active) endDrag();
  }

  el('zoom-in').onclick = () => { zoom = Math.min(4, zoom * 1.25); update(); };
  el('zoom-out').onclick = () => { zoom = Math.max(1, zoom / 1.25); update(); };
  el('rotate').onclick = () => { rotation = (rotation + 90) % 360; update(); };
  el('fit').onclick = reset;
  pan.onclick = () => {
    ink.select(undefined);
    togglePan(!stage.classList.contains('pan'));
  };

  stage.onpointerdown = event => {
    if (!page || remoteView) return;
    if (event.pointerType === 'touch') {
      if (touches.size >= 2 || drag) return;
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      stage.setPointerCapture(event.pointerId);
      if (touches.size === 2 && ink.pointer !== undefined && touches.has(ink.pointer)) {
        ink.finish(false);
      } else if (touches.size === 1 && ink.fingerDrawing && ink.pointer === undefined) {
        ink.start(event);
      }
      return;
    }
    if (ink.enabled && ink.pointer === undefined && event.button === 0 && !drag) {
      stage.setPointerCapture(event.pointerId);
      ink.start(event);
      return;
    }
    if (!stage.classList.contains('pan') || event.button !== 0 || drag || touches.size) return;
    drag = { id: event.pointerId, x: event.clientX - x, y: event.clientY - y };
    stage.setPointerCapture(event.pointerId);
    stage.classList.add('dragging');
  };
  stage.onpointermove = event => {
    if (ink.pointer === event.pointerId) {
      if (touches.has(event.pointerId)) touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      ink.move(event);
      return;
    }
    if (touches.has(event.pointerId)) {
      const before = touchPosition();
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const after = touchPosition();
      if (touches.size === 2 && before.distance >= 1) {
        const nextZoom = Math.max(1, Math.min(4, zoom * after.distance / before.distance));
        const ratio = nextZoom / zoom;
        const rect = stage.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        x = after.x - centerX - (before.x - centerX - x) * ratio;
        y = after.y - centerY - (before.y - centerY - y) * ratio;
        zoom = nextZoom;
      } else if (touches.size === 1 && zoom > 1 && !ink.fingerDrawing && ink.pointer === undefined) {
        x += after.x - before.x;
        y += after.y - before.y;
      }
      update();
      return;
    }
    if (drag?.id !== event.pointerId) return;
    x = event.clientX - drag.x;
    y = event.clientY - drag.y;
    update();
  };
  stage.onpointerup = stage.onpointercancel = stage.onlostpointercapture = event => {
    if (ink.pointer === event.pointerId) {
      ink.finish(event.type === 'pointerup');
    }
    if (touches.delete(event.pointerId) && stage.hasPointerCapture(event.pointerId)) {
      stage.releasePointerCapture(event.pointerId);
    }
    if (drag?.id === event.pointerId) endDrag();
  };

  new ResizeObserver(update).observe(stage);
  el('page-image').addEventListener('load', update);
  return {
    show(element, initialView) {
      page = element;
      tools.hidden = Boolean(initialView);
      remoteView = undefined;
      lastView = undefined;
      rotation = 0;
      if (initialView) {
        this.follow(initialView);
        return;
      }
      reset();
    },
    follow(state) {
      remoteView = state;
      zoom = state.zoom;
      rotation = state.rotation;
      update();
    },
    clear() {
      clearTouches();
      page = undefined;
      tools.hidden = true;
      togglePan(false);
    },
  };
}
