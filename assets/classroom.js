"use strict";

(() => {
  const stage = document.querySelector(".classroom");
  const canvas = stage.querySelector(".room");
  const board = stage.querySelector(".whiteboard");
  const writing = stage.querySelector(".board-content");
  const eraser = stage.querySelector(".board-eraser");
  const notebooks = [...stage.querySelectorAll(".notebook")];
  const previous = stage.querySelector(".previous");
  const next = stage.querySelector(".next");
  const deskLink = stage.querySelector(".desk-notebook");
  const deskTitle = deskLink.querySelector(".desk-title");
  const entrance = stage.querySelector(".entrance-control");
  const hand = stage.querySelector(".classroom-hand");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let room;
  let seated = false;
  let active = -1;
  let eraserFrame;
  let eraserTime;
  let eraserPosition = 0;
  let eraserTarget = 0;
  let eraserVelocity = 0;
  let wheelDistance = 0;
  let lastWheelTime = -Infinity;
  let wheelDirection = 0;
  let touch = null;
  let suppressTouchClick = false;
  let handPosition;
  let handFrame;

  function sitDown() {
    if (seated) return;
    room?.sit();
    seated = true;
    const returnFocus = document.activeElement === entrance && stage.dataset.view === "walking";
    entrance.textContent = "Watch intro";
    entrance.hidden = !room || motion.matches;
    if (active < 0 && notebooks.length) selectNotebook(0);
    deskLink.hidden = !deskLink.hasAttribute("href");
    scheduleHand();
    if (notebooks.length > 1) document.body.classList.add("has-controls");
    stage.dataset.view = "seated";
    board.hidden = false;
    if (returnFocus && notebooks.length) (notebooks.length > 1 ? next : deskLink).focus();
  }

  function watchEntrance() {
    if (!seated) {
      sitDown();
      return;
    }
    if (!room || motion.matches) return;
    seated = false;
    stopEraser();
    eraser.hidden = true;
    touch = null;
    board.hidden = true;
    deskLink.hidden = true;
    stage.dataset.view = "walking";
    entrance.textContent = "Skip intro";
    room.walk(sitDown);
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

  function selectNotebook(index) {
    if (active === index) return;
    if (active >= 0) notebooks[active].hidden = true;
    active = index;
    notebooks[active].hidden = false;
    updateDeskBook();
  }

  function paintEraser() {
    const position = Math.max(-1, Math.min(1, eraserPosition));
    eraser.style.transform = `translateX(${position * 410}%) rotate(${position * 12}deg)`;
    eraser.style.opacity = Math.min(1, (1 - Math.abs(position)) * 5);
  }

  function stopEraser() {
    cancelAnimationFrame(eraserFrame);
    eraserFrame = undefined;
    eraserTime = undefined;
    eraserVelocity = 0;
  }

  function settleEraser(now) {
    // Solve the critically damped spring from its current position and velocity.
    const elapsed = eraserTime === undefined ? 0 : Math.min((now - eraserTime) / 1000, .05);
    const response = 16;
    const offset = eraserPosition - eraserTarget;
    const rate = eraserVelocity + response * offset;
    const decay = Math.exp(-response * elapsed);
    eraserPosition = eraserTarget + (offset + rate * elapsed) * decay;
    eraserVelocity = (eraserVelocity - response * rate * elapsed) * decay;
    paintEraser();
    if (Math.abs(eraserPosition - eraserTarget) < .004 && Math.abs(eraserVelocity) < .05) {
      stopEraser();
      eraser.hidden = true;
      return;
    }
    eraserTime = now;
    eraserFrame = requestAnimationFrame(settleEraser);
  }

  function sweepEraser(direction) {
    if (motion.matches) return;
    eraserTarget = -direction;
    if (eraser.hidden) {
      eraserPosition = direction;
      eraser.hidden = false;
      paintEraser();
    }
    if (eraserFrame === undefined) eraserFrame = requestAnimationFrame(settleEraser);
  }

  function turn(direction) {
    if (!seated || notebooks.length < 2) return;
    selectNotebook((active + direction + notebooks.length) % notebooks.length);
    if (!touch?.axis) sweepEraser(direction);
  }

  previous.addEventListener("click", () => turn(-1));
  next.addEventListener("click", () => turn(1));
  entrance.addEventListener("click", watchEntrance);
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
  motion.addEventListener("change", () => {
    if (motion.matches) {
      if (document.activeElement === entrance && seated) (notebooks.length > 1 ? next : deskLink).focus();
      sitDown();
      stopEraser();
      eraser.hidden = true;
    }
    entrance.hidden = !room || motion.matches;
  });

  stage.addEventListener("wheel", event => {
    if (!seated || notebooks.length < 2 || event.ctrlKey) return;
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
      id: event.pointerId, x: event.clientX, y: event.clientY, started: event.timeStamp,
      book: event.target.closest(".desk-notebook[href]")
    };
  });

  stage.addEventListener("pointermove", event => {
    if (touch?.id !== event.pointerId || notebooks.length < 2) return;
    const dx = event.clientX - touch.x;
    const dy = event.clientY - touch.y;
    if (!touch.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 14) return;
      touch.axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
      touch.distance = Math.max(1, writing.getBoundingClientRect().width * .41);
      const travel = touch.axis === "x" ? dx : dy;
      touch.origin = eraser.hidden ? 0 : eraserPosition - travel / touch.distance;
      stopEraser();
      stage.setPointerCapture(event.pointerId);
    }
    const delta = touch.axis === "x" ? dx : dy;
    const cutoff = event.timeStamp - 80;
    touch.samples = (touch.samples ?? []).filter(sample => sample.time >= cutoff);
    touch.samples.push({ delta, time: event.timeStamp });
    if (motion.matches) return;
    eraserPosition = touch.origin + delta / touch.distance;
    eraser.hidden = false;
    paintEraser();
  });

  stage.addEventListener("pointerup", event => {
    if (touch?.id !== event.pointerId) return;
    const { x, y, started, axis, distance, samples, book } = touch;
    touch = null;
    const dx = event.clientX - x;
    const dy = event.clientY - y;
    const delta = axis === "x" ? dx : axis === "y" ? dy : Math.abs(dx) >= Math.abs(dy) ? dx : dy;
    const first = samples?.find(sample => event.timeStamp - sample.time <= 80);
    const elapsed = first ? event.timeStamp - first.time : 0;
    const speed = elapsed >= 8 ? (delta - first.delta) * 1000 / elapsed : 0;
    const projected = delta + Math.max(-40, Math.min(40, speed * .12));
    const destination = Math.abs(delta) >= 32 ? delta : Math.abs(delta) >= 18 ? projected : 0;
    suppressTouchClick = Boolean(axis) || Math.abs(delta) >= 32;
    if (axis && !motion.matches) {
      eraserPosition = Math.max(-1, Math.min(1, eraserPosition));
      eraserVelocity = Math.max(-8, Math.min(8, speed / distance));
    }
    if (Math.abs(destination) >= 32) {
      turn(-Math.sign(destination));
    } else if (axis && !eraser.hidden) {
      sweepEraser(eraserPosition > 0 ? -1 : 1);
    } else if (!axis && Math.abs(delta) < 14 && event.timeStamp - started < 550 && book &&
               book.contains(document.elementFromPoint(event.clientX, event.clientY))) {
      // Open on touch release even when the browser suppresses the follow-up click after a swipe.
      suppressTouchClick = true;
      book.click();
    }
  });

  function cancelSwipe(event) {
    if (touch?.id !== event.pointerId) return;
    const wasDragging = Boolean(touch.axis);
    touch = null;
    if (wasDragging && !eraser.hidden) sweepEraser(eraserPosition > 0 ? -1 : 1);
  }
  stage.addEventListener("pointercancel", cancelSwipe);
  stage.addEventListener("lostpointercapture", cancelSwipe);
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
    if (!seated || notebooks.length < 2 || event.repeat) return;
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
    entrance.hidden = true;
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
  sitDown();
})();
