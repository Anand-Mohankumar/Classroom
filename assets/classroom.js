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
  const hand = stage.querySelector(".classroom-hand");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let room;
  let seated = false;
  let active = -1;
  let pending = null;
  let eraseDirection = 1;
  let eraseTimer;
  let welcomeTimer;
  let browsed = false;
  let wheelDistance = 0;
  let lastWheelTime = -Infinity;
  let wheelDirection = 0;
  let touch = null;
  let suppressTouchClick = false;
  let handPosition;
  let handFrame;

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
    const returnFocus = document.activeElement === skip;
    skip.hidden = true;
    deskLink.hidden = false;
    updateDeskBook();
    scheduleHand();
    writing.classList.add("is-writing");
    if (notebooks.length) document.body.classList.add("has-controls");
    stage.dataset.view = "seated";
    board.hidden = false;
    if (returnFocus && notebooks.length) next.focus();
    scheduleWelcome();
  }

  function paintHand() {
    handFrame = undefined;
    if (!handPosition || !hand.complete || !hand.naturalWidth) return;
    const { x, y } = handPosition;
    const fallbackLength = Math.min(stage.clientWidth, stage.clientHeight) * .28;
    const pencilLength = seated && room ? room.pencilScreenLength() : fallbackLength;
    const reach = Math.max(0, Math.min(1, (y / stage.clientHeight - .40) / .35));
    // The extended index finger makes the pointing pose slightly shorter than the pencil.
    const handSize = Math.max(64, pencilLength * .94 * (.55 + .45 * reach * reach * (3 - 2 * reach)));
    hand.style.setProperty("--hand-x", `${x}px`);
    hand.style.setProperty("--hand-y", `${y}px`);
    hand.style.setProperty("--hand-size", `${handSize}px`);
    hand.hidden = false;
    stage.classList.add("is-pointing");
  }

  function scheduleHand() {
    if (handPosition && handFrame === undefined) handFrame = requestAnimationFrame(paintHand);
  }

  function hideHand() {
    handPosition = undefined;
    hand.hidden = true;
    stage.classList.remove("is-pointing");
  }

  function updateDeskBook() {
    const notebook = notebooks[active];
    const title = notebook ? notebook.textContent.trim() : "CyberAmo's Classroom";
    const color = notebook?.dataset.coverColor || "#8f432f";
    deskTitle.textContent = title;
    deskLink.style.setProperty("--book-cover-color", color);
    if (notebook?.dataset.url) {
      const url = notebook.dataset.url;
      deskLink.setAttribute("href", location.protocol === "file:" && url.endsWith("/") ? url + "index.html" : url);
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

  function requestNotebook(index, direction = 1) {
    if (pending === null && active === index) return;
    const sameSweep = pending !== null && direction === eraseDirection;
    pending = index;
    if (motion.matches) {
      replaceWriting();
      return;
    }
    if (sameSweep) return;
    eraseDirection = direction;
    writing.dataset.wipeDirection = direction > 0 ? "left" : "right";
    writing.classList.remove("is-writing");
    writing.classList.add("is-erasing");
    clearTimeout(eraseTimer);
    eraseTimer = setTimeout(replaceWriting, 520);
  }

  function turn(direction) {
    if (!seated || !notebooks.length) return;
    browsed = true;
    clearTimeout(welcomeTimer);
    const index = pending ?? active;
    if (notebooks.length === 1) {
      requestNotebook(index < 0 ? 0 : -1, direction);
    } else if (index < 0) {
      requestNotebook(direction > 0 ? 0 : notebooks.length - 1, direction);
    } else {
      requestNotebook((index + direction + notebooks.length) % notebooks.length, direction);
    }
  }

  stage.querySelector(".board-eraser").addEventListener("animationend", (event) => {
    if (pending !== null && event.animationName === `sweep-to-${writing.dataset.wipeDirection}`) replaceWriting();
  });
  previous.addEventListener("click", () => turn(-1));
  next.addEventListener("click", () => turn(1));
  skip.addEventListener("click", sitDown);
  hand.addEventListener("load", scheduleHand);
  stage.addEventListener("pointermove", event => {
    if (event.pointerType !== "mouse") {
      hideHand();
      return;
    }
    const bounds = stage.getBoundingClientRect();
    handPosition = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    scheduleHand();
  }, { passive: true });
  stage.addEventListener("pointerleave", hideHand);
  stage.addEventListener("pointercancel", hideHand);
  window.addEventListener("blur", hideHand);
  document.addEventListener("visibilitychange", scheduleWelcome);
  motion.addEventListener("change", event => {
    if (!event.matches) return;
    sitDown();
    if (pending !== null) replaceWriting();
  });

  stage.addEventListener("wheel", event => {
    if (!seated || event.ctrlKey) return;
    const dominant = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (!dominant) return;
    event.preventDefault();
    const now = performance.now();
    if (now - lastWheelTime > 180) {
      wheelDirection = 0;
      wheelDistance = 0;
    }
    lastWheelTime = now;
    const direction = Math.sign(dominant);
    if (direction === wheelDirection) {
      wheelDistance = 0;
      return;
    }
    if (wheelDistance && Math.sign(wheelDistance) !== direction) wheelDistance = 0;
    const multiplier = event.deltaMode === 1 ? 17 : event.deltaMode === 2 ? stage.clientHeight : 1;
    wheelDistance += dominant * multiplier;
    if (Math.abs(wheelDistance) < 32) return;
    wheelDirection = direction;
    wheelDistance = 0;
    turn(direction);
  }, { passive: false });

  stage.addEventListener("pointerdown", event => {
    if (!seated || !event.isPrimary) return;
    suppressTouchClick = false;
    if (event.pointerType !== "touch") return;
    touch = {
      id: event.pointerId, x: event.clientX, y: event.clientY, started: event.timeStamp, dragging: false,
      book: event.target.closest(".desk-notebook[href]")
    };
  });

  stage.addEventListener("pointermove", event => {
    if (touch?.id !== event.pointerId || touch.dragging) return;
    const distance = Math.max(Math.abs(touch.x - event.clientX), Math.abs(touch.y - event.clientY));
    if (distance < 14) return;
    touch.dragging = true;
    stage.setPointerCapture(event.pointerId);
  });

  stage.addEventListener("pointerup", event => {
    if (touch?.id !== event.pointerId) return;
    const { x, y, started, dragging, book } = touch;
    touch = null;
    const horizontal = x - event.clientX;
    const vertical = y - event.clientY;
    const dominant = Math.abs(horizontal) >= Math.abs(vertical) ? horizontal : vertical;
    suppressTouchClick = dragging || Math.abs(dominant) >= 32;
    if (Math.abs(dominant) >= 32) {
      turn(Math.sign(dominant));
    } else if (!dragging && Math.abs(dominant) < 14 && event.timeStamp - started < 550 && book &&
               book.contains(document.elementFromPoint(event.clientX, event.clientY))) {
      // Open on touch release even when the browser suppresses the follow-up click after a swipe.
      suppressTouchClick = true;
      book.click();
    }
  });

  stage.addEventListener("pointercancel", () => { touch = null; });
  stage.addEventListener("click", event => {
    const touchClick = event.pointerType === "touch" || (!event.pointerType && event.isTrusted && event.detail > 0);
    if (suppressTouchClick && touchClick) {
      suppressTouchClick = false;
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
  window.addEventListener("resize", () => {
    room?.resize();
    scheduleHand();
  }, { passive: true });
  if (motion.matches) {
    sitDown();
  } else {
    stage.dataset.view = "walking";
    skip.hidden = false;
    room.walk(sitDown);
  }
})();
