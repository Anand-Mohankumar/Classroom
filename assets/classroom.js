"use strict";

(() => {
  const stage = document.querySelector(".classroom");
  const canvas = stage.querySelector(".room");
  const board = stage.querySelector(".whiteboard");
  const writing = stage.querySelector(".board-content");
  const welcome = stage.querySelector(".welcome");
  const notebooks = [...stage.querySelectorAll(".notebook")];
  const previous = stage.querySelector(".previous");
  const next = stage.querySelector(".next");
  const deskLink = stage.querySelector(".desk-notebook");
  const deskTitle = deskLink.querySelector(".desk-title");
  const skip = stage.querySelector(".skip-entrance");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let room;
  let seated = false;
  let active = -1;
  let pending = null;
  let eraseTimer;
  let welcomeTimer;
  let browsed = false;
  let wheelDistance = 0;
  let lastWheelTime = -Infinity;
  let wheelTurned = false;
  let touch = null;
  let suppressTouchClickUntil = 0;

  function scheduleWelcome() {
    clearTimeout(welcomeTimer);
    if (!document.hidden && seated && !browsed && active < 0 && notebooks.length) {
      welcomeTimer = setTimeout(() => requestNotebook(0), 2200);
    }
  }

  function sitDown() {
    if (seated) return;
    room?.sit();
    seated = true;
    stage.dataset.view = "seated";
    const returnFocus = document.activeElement === skip;
    skip.hidden = true;
    deskLink.hidden = false;
    updateDeskBook();
    writing.classList.add("is-writing");
    if (notebooks.length) {
      document.body.classList.add("has-controls");
      if (returnFocus) next.focus();
    }
    scheduleWelcome();
  }

  function updateDeskBook() {
    const notebook = notebooks[active];
    const title = notebook ? notebook.textContent.trim() : "CyberAmo's Classroom";
    const color = notebook?.dataset.coverColor || "#8f432f";
    deskTitle.textContent = title;
    deskLink.style.setProperty("--book-cover-color", color);
    if (notebook?.dataset.url) {
      deskLink.setAttribute("href", notebook.dataset.url);
      deskLink.setAttribute("aria-label", `${title} (opens in a new tab)`);
    } else {
      const hadFocus = document.activeElement === deskLink;
      deskLink.removeAttribute("href");
      deskLink.removeAttribute("aria-label");
      if (hadFocus) next.focus();
    }
    room?.setBookCover(title, color);
  }

  function replaceWriting() {
    clearTimeout(eraseTimer);
    const lastSlide = active < 0 ? welcome : notebooks[active];
    lastSlide.hidden = true;
    active = pending;
    pending = null;
    const slide = active < 0 ? welcome : notebooks[active];
    slide.hidden = false;
    writing.classList.remove("is-erasing");
    writing.classList.add("is-writing");
    updateDeskBook();
  }

  function requestNotebook(index) {
    if (pending !== null) {
      pending = index;
      return;
    }
    if (active === index) return;
    pending = index;
    if (motion.matches) {
      replaceWriting();
      return;
    }
    writing.classList.remove("is-writing");
    writing.classList.add("is-erasing");
    eraseTimer = setTimeout(replaceWriting, 405);
  }

  function turn(direction) {
    if (!seated || !notebooks.length) return;
    browsed = true;
    clearTimeout(welcomeTimer);
    const index = pending ?? active;
    if (notebooks.length === 1) {
      requestNotebook(index < 0 ? 0 : -1);
    } else if (index < 0) {
      requestNotebook(direction > 0 ? 0 : notebooks.length - 1);
    } else {
      requestNotebook((index + direction + notebooks.length) % notebooks.length);
    }
  }

  previous.addEventListener("click", () => turn(-1));
  next.addEventListener("click", () => turn(1));
  skip.addEventListener("click", sitDown);
  document.addEventListener("visibilitychange", scheduleWelcome);
  motion.addEventListener("change", event => {
    if (!event.matches) return;
    sitDown();
    if (pending !== null) replaceWriting();
  });

  stage.addEventListener("wheel", event => {
    if (!seated || event.ctrlKey) return;
    const now = performance.now();
    if (now - lastWheelTime > 180) {
      wheelTurned = false;
      wheelDistance = 0;
    }
    lastWheelTime = now;
    if (wheelTurned) return;
    const dominant = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    const multiplier = event.deltaMode === 1 ? 17 : event.deltaMode === 2 ? stage.clientHeight : 1;
    wheelDistance += dominant * multiplier;
    if (Math.abs(wheelDistance) < 32) return;
    wheelTurned = true;
    turn(Math.sign(wheelDistance));
  }, { passive: true });

  stage.addEventListener("pointerdown", event => {
    if (!seated || event.pointerType !== "touch" || !event.isPrimary) return;
    touch = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });

  stage.addEventListener("pointerup", event => {
    if (touch?.id !== event.pointerId) return;
    const x = touch.x - event.clientX;
    const y = touch.y - event.clientY;
    touch = null;
    const dominant = Math.abs(x) >= Math.abs(y) ? x : y;
    if (Math.abs(dominant) < 32) return;
    suppressTouchClickUntil = performance.now() + 550;
    turn(Math.sign(dominant));
  });

  stage.addEventListener("pointercancel", () => { touch = null; });
  stage.addEventListener("click", event => {
    if (event.detail && performance.now() < suppressTouchClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, { capture: true });

  window.addEventListener("keydown", event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!seated && event.key === "Escape") {
      sitDown();
      return;
    }
    if (!seated || event.repeat) return;
    const direction = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
    if (!direction) return;
    event.preventDefault();
    turn(direction);
  });

  function showFallback() {
    canvas.hidden = true;
    stage.classList.remove("has-room");
    for (const name of ["left", "top", "width", "height"]) board.style.removeProperty(`--board-${name}`);
    room?.stop();
    room = undefined;
    sitDown();
  }

  try {
    room = window.createClassroomRoom(stage, canvas, board, deskLink);
    canvas.hidden = false;
    stage.classList.add("has-room");
  } catch {
    showFallback();
    return;
  }

  canvas.addEventListener("webglcontextlost", showFallback, { once: true });
  window.addEventListener("resize", () => room?.resize(), { passive: true });
  if (motion.matches) {
    sitDown();
  } else {
    stage.dataset.view = "walking";
    skip.hidden = false;
    room.walk(sitDown);
  }
})();
