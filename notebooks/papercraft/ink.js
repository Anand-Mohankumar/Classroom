"use strict";

(() => {
  const root = document.documentElement;
  const dialog = document.querySelector(".search-dialog");
  const layers = ["page-ink", "dialog-ink"].map((id) => {
    const canvas = document.getElementById(id);
    return { canvas, context: canvas.getContext("2d"), fixed: id === "dialog-ink" };
  });
  if (layers.some((layer) => !layer.context)) return;

  const [pageLayer, dialogLayer] = layers;
  const holdTime = 850;
  const lifetime = 2150;
  const circleTime = 360;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let gesture = null;
  let strokes = [];
  let frame = 0;
  let suppressDragClick = false;

  function inkPoint(event, layer) {
    return {
      x: event.clientX + (layer.fixed ? 0 : window.scrollX),
      y: event.clientY + (layer.fixed ? 0 : window.scrollY),
    };
  }

  function schedulePaint() {
    if (!frame) frame = requestAnimationFrame(paint);
  }

  function circleMatch(range, elapsed) {
    const progress = reduceMotion.matches ? 1 : Math.min(1, Math.max(0, elapsed / circleTime));
    const lines = [];
    for (const rect of range.getClientRects()) {
      if (!rect.width || !rect.height) continue;
      const line = lines.find((candidate) =>
        rect.top < candidate.bottom && rect.bottom > candidate.top &&
        Math.abs(rect.top - candidate.top) < rect.height / 2);
      if (line) {
        line.left = Math.min(line.left, rect.left);
        line.right = Math.max(line.right, rect.right);
        line.top = Math.min(line.top, rect.top);
        line.bottom = Math.max(line.bottom, rect.bottom);
      } else {
        lines.push({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
      }
    }

    const path = new Path2D();
    const table = range.startContainer.parentElement.closest(".table-frame")?.getBoundingClientRect();
    for (const line of lines) {
      const left = Math.max(line.left, table?.left ?? 0);
      const right = Math.min(line.right, table?.right ?? document.documentElement.clientWidth);
      if (right <= left) continue;
      const x = (left + right) / 2 + scrollX;
      const y = (line.top + line.bottom) / 2 + scrollY;
      const radiusX = (right - left) / 2 + 10;
      const radiusY = (line.bottom - line.top) / 2 + 5;
      const steps = Math.max(1, Math.ceil(80 * progress));
      for (let i = 0; i <= steps; i++) {
        const angle = -.65 + i / steps * progress * (2 * Math.PI + .16);
        const wiggle = 1 + .027 * Math.sin(angle * 3 + .7) + .018 * Math.cos(angle * 5);
        const dx = radiusX * Math.cos(angle) * wiggle;
        const dy = radiusY * Math.sin(angle) * wiggle;
        const tiltedY = y + dy - .018 * dx;
        if (i === 0) path.moveTo(x + dx, tiltedY);
        else path.lineTo(x + dx, tiltedY);
      }
    }
    return path;
  }

  function paint(now) {
    frame = 0;
    strokes = strokes.filter((stroke) => now - stroke.finished < lifetime);
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    for (const layer of layers) {
      const { canvas, context, fixed } = layer;
      if (!canvas.clientWidth || !canvas.clientHeight) continue;
      const width = Math.round(canvas.clientWidth * pixelRatio);
      const height = Math.round(canvas.clientHeight * pixelRatio);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.resetTransform();
      context.clearRect(0, 0, width, height);
      context.scale(pixelRatio, pixelRatio);
      if (!fixed) context.translate(-window.scrollX, -window.scrollY);
      context.strokeStyle = "#171614";
      context.lineWidth = 2.25;
      context.lineCap = "round";
      context.lineJoin = "round";
      for (const stroke of strokes) {
        if (stroke.layer !== layer) continue;
        const age = now - stroke.finished;
        context.globalAlpha = reduceMotion.matches ? 1 : 1 - Math.max(0, age - holdTime) / (lifetime - holdTime);
        context.stroke(stroke.range ? circleMatch(stroke.range, now - stroke.started) : stroke.path);
      }
    }
    if (strokes.some((stroke) => Number.isFinite(stroke.finished))) schedulePaint();
  }

  document.addEventListener("careermap:circle-match", (event) => {
    const started = performance.now();
    strokes = strokes.filter((stroke) => !stroke.range);
    strokes.push({
      layer: pageLayer,
      range: event.detail,
      started,
      finished: started + (reduceMotion.matches ? 0 : circleTime),
    });
    schedulePaint();
  });

  window.addEventListener("pointerdown", (event) => {
    if (gesture) return;
    suppressDragClick = false;
    if (event.button !== 0 || !event.isPrimary || event.pointerType === "touch") return;
    const layer = dialog.open ? dialogLayer : pageLayer;
    gesture = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      layer,
      start: inkPoint(event, layer),
      path: null,
      finished: Infinity,
    };
  }, true);

  window.addEventListener("pointermove", (event) => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (!(event.buttons & 1)) {
      finishGesture(false);
      return;
    }
    if (!gesture.path) {
      if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) < 5) return;
      gesture.path = new Path2D();
      gesture.path.moveTo(gesture.start.x, gesture.start.y);
      strokes.push(gesture);
      root.classList.add("is-inking");
    }
    const point = inkPoint(event, gesture.layer);
    gesture.path.lineTo(point.x, point.y);
    schedulePaint();
  }, true);

  function finishGesture(suppressClick) {
    if (!gesture) return;
    if (gesture.path) {
      gesture.finished = performance.now();
      suppressDragClick = suppressClick;
      schedulePaint();
    }
    gesture = null;
    root.classList.remove("is-inking");
  }

  window.addEventListener("pointerup", (event) => {
    if (event.pointerId === gesture?.pointerId) finishGesture(true);
  }, true);
  window.addEventListener("pointercancel", (event) => {
    if (event.pointerId === gesture?.pointerId) finishGesture(false);
  }, true);
  window.addEventListener("blur", () => finishGesture(false));
  for (const type of ["selectstart", "dragstart"]) {
    window.addEventListener(type, (event) => {
      if (gesture) event.preventDefault();
    }, true);
  }
  window.addEventListener("click", (event) => {
    if (!suppressDragClick || event.detail === 0) return;
    suppressDragClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  window.addEventListener("scroll", () => {
    if (strokes.length) schedulePaint();
  }, { passive: true });
  window.addEventListener("resize", () => {
    if (strokes.length) schedulePaint();
  });
})();
