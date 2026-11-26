"use strict";

const root = document.documentElement;
const chapters = [...document.querySelectorAll("[data-chapter]")];
const chapterLinks = [...document.querySelectorAll("[data-chapter-link]")];
const contentsMenu = document.querySelector(".contents-menu");
const contentsToggle = contentsMenu.querySelector("summary");
const readingLine = document.querySelector(".reading-line");
const backToTop = document.querySelector(".back-to-top");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const reload = performance.getEntriesByType("navigation")[0]?.type === "reload";
const readingPositionKey = "classroom-notebook-reading-position";
let savedScroll;

try {
  const previous = JSON.parse(sessionStorage.getItem(readingPositionKey));
  if (reload && previous?.url === location.href) savedScroll = previous.top;
} catch {
  // The notebook also opens when browser storage is disabled.
}

// Keep the reading position in this tab while the cover replays at the top.
window.addEventListener("pagehide", () => {
  if (root.classList.contains("is-opening")) return;
  try {
    sessionStorage.setItem(readingPositionKey, JSON.stringify({ url: location.href, top: window.scrollY }));
  } catch {
    // A chapter fragment can still be restored without storage.
  }
});

function updateTableHint(frame) {
  const hint = frame.previousElementSibling;
  hint.hidden = frame.scrollWidth <= frame.clientWidth + 1;
}

const tableObserver = new ResizeObserver((entries) => {
  for (const { target } of entries) updateTableHint(target);
});
for (const frame of document.querySelectorAll(".lecture-table")) {
  updateTableHint(frame);
  tableObserver.observe(frame);
}

if (root.classList.contains("is-opening")) {
  const desk = document.querySelector(".opening-desk");
  const wood = window.classroomSurfaceTextures?.wood;
  if (wood) desk.style.setProperty("--opening-desk-texture", `url("${wood}")`);

  const book = document.querySelector(".book");
  const { left, top, width } = book.getBoundingClientRect();
  const { clientWidth, clientHeight } = root;
  // Keep the edge of the temporary page below the viewport at the end of the zoom.
  const pageHeight = Math.max(book.querySelector(".cover").offsetHeight, width * 1.08, clientHeight - top + 36);
  const widthLimit = window.matchMedia("(max-width: 42rem)").matches ? .72 : .5;
  const scale = Math.min(clientWidth * widthLimit / width, clientHeight * .64 / pageHeight);
  const openingFrame = {
    "--opening-height": `${pageHeight}px`,
    "--opening-scale": scale,
    "--opening-x": `${(clientWidth - width * scale) / 2 - left}px`,
    "--opening-y": `${(clientHeight - pageHeight * scale) / 2 - top}px`,
  };
  for (const [property, value] of Object.entries(openingFrame)) book.style.setProperty(property, value);

  const listeners = new AbortController();
  const options = { signal: listeners.signal, passive: true, capture: true };
  const fallback = setTimeout(finishOpening, 3200);

  function finishOpening() {
    root.classList.remove("is-opening", "is-opening-ready");
    for (const property of Object.keys(openingFrame)) book.style.removeProperty(property);
    clearTimeout(fallback);
    listeners.abort();
    history.scrollRestoration = "auto";
    if (!reload) return;
    if (Number.isFinite(savedScroll)) {
      window.scrollTo({ top: savedScroll, behavior: "instant" });
    } else if (location.hash.length > 1) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "instant" });
    }
  }

  book.addEventListener("animationend", (event) => {
    if (event.target === book && event.animationName === "approach-book") finishOpening();
  }, options);
  for (const type of ["pointerdown", "keydown", "wheel", "touchstart"]) {
    window.addEventListener(type, finishOpening, options);
  }
  window.addEventListener("resize", () => {
    if (root.clientWidth !== clientWidth) finishOpening();
  }, options);
  reduceMotion.addEventListener("change", finishOpening, options);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) finishOpening();
  }, options);
  root.classList.add("is-opening-ready");
}

let queuedFrame = null;
let currentChapter = "";

function syncReadingPosition() {
  queuedFrame = null;
  const scrolling = document.scrollingElement;
  const distance = scrolling.scrollHeight - scrolling.clientHeight;
  const progress = distance > 0 ? Math.min(1, Math.max(0, scrolling.scrollTop / distance)) : 0;
  const lastSheet = chapters.at(-1);
  const bookEndSpace = Math.max(0, scrolling.clientHeight - lastSheet.getBoundingClientRect().bottom);
  readingLine.style.setProperty("--read", progress);
  backToTop.hidden = scrolling.scrollTop <= 0;
  backToTop.style.setProperty("--book-end-space", bookEndSpace + "px");

  const readingEdge = document.querySelector(".site-header").offsetHeight + 75;
  const active = chapters.findLast((chapter) => chapter.getBoundingClientRect().top <= readingEdge) ?? chapters[0];
  if (active.id === currentChapter) return;

  currentChapter = active.id;
  for (const link of chapterLinks) {
    if (link.dataset.chapterLink === currentChapter) {
      link.setAttribute("aria-current", "location");
    } else {
      link.removeAttribute("aria-current");
    }
  }
}

function queuePositionUpdate() {
  if (queuedFrame === null) queuedFrame = requestAnimationFrame(syncReadingPosition);
}

window.addEventListener("scroll", queuePositionUpdate, { passive: true });
window.addEventListener("resize", queuePositionUpdate);
window.addEventListener("pageshow", queuePositionUpdate);
syncReadingPosition();

backToTop.addEventListener("click", (event) => {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (location.hash !== "#top") history.pushState(null, "", "#top");
  document.querySelector(".wordmark").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: reduceMotion.matches ? "instant" : "smooth" });
});

contentsMenu.querySelector("nav").addEventListener("click", (event) => {
  const link = event.target.closest("a");
  if (!link) return;
  const heading = document.getElementById(link.dataset.chapterLink + "-title");
  contentsMenu.open = false;
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
});
document.addEventListener("pointerdown", (event) => {
  if (contentsMenu.open && !contentsMenu.contains(event.target)) contentsMenu.open = false;
});

const searchDialog = document.querySelector(".search-dialog");
const findButton = document.querySelector("[data-find]");
const input = searchDialog.querySelector("input");
const results = searchDialog.querySelector(".search-results");
const resultCount = searchDialog.querySelector(".result-count");

searchDialog.querySelector("[data-close]").addEventListener("click", () => searchDialog.close());
searchDialog.addEventListener("click", (event) => {
  if (event.target !== searchDialog) return;
  const bounds = searchDialog.getBoundingClientRect();
  const outside = event.clientX < bounds.left || event.clientX > bounds.right ||
    event.clientY < bounds.top || event.clientY > bounds.bottom;
  if (outside) searchDialog.close();
});

const indexedEntries = chapters.flatMap((chapter) => {
  const chapterTitle = chapter.querySelector("h2").textContent;
  const entries = chapter.querySelectorAll("h2, h3, h4, p:not(.table-scroll-hint), .note-line:not(td *, th *), li:not(:has(.note-line)), thead tr, tbody tr");
  return [...entries].map((element, index) => {
    if (!element.id) element.id = chapter.id + "-note-" + (index + 1);
    const content = element.matches("tr")
      ? [...element.cells].map((cell) => cell.textContent.trim()).filter(Boolean).join(" · ")
      : element.textContent.trim().replace(/\s+/g, " ");
    return { element, chapterTitle, content, searchable: content.toLowerCase() };
  });
});

function renderResults() {
  const query = input.value.trim().toLowerCase();
  results.replaceChildren();
  resultCount.textContent = "";
  if (!query) return;

  const words = query.split(/\s+/);
  const matches = indexedEntries.filter((entry) => words.every((word) => entry.searchable.includes(word)));
  const visible = matches.slice(0, 35);
  if (matches.length > visible.length) {
    resultCount.textContent = "Showing " + visible.length + " of " + matches.length + " matches";
  } else {
    resultCount.textContent = matches.length === 1 ? "1 match" : matches.length + " matches";
  }

  const rows = document.createDocumentFragment();
  for (const entry of visible) {
    const row = document.createElement("li");
    const link = document.createElement("a");
    const chapterLabel = document.createElement("small");
    chapterLabel.textContent = entry.chapterTitle;
    link.href = "#" + entry.element.id;
    link.append(chapterLabel);

    const phrasePosition = entry.searchable.indexOf(query);
    if (phrasePosition < 0) {
      link.append(entry.content);
    } else {
      const emphasis = document.createElement("mark");
      emphasis.textContent = entry.content.slice(phrasePosition, phrasePosition + query.length);
      link.append(entry.content.slice(0, phrasePosition), emphasis, entry.content.slice(phrasePosition + query.length));
    }
    row.append(link);
    rows.append(row);
  }
  results.append(rows);
}

function findMatchRange(target, query) {
  const fields = target.matches("tr") ? [...target.cells] : [target];
  const terms = query.trim().split(/\s+/)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const phrase = new RegExp(terms.join("\\s+"), "i");
  const keyword = new RegExp(terms.join("|"), "i");
  for (const pattern of [phrase, keyword]) {
    for (const field of fields) {
      const match = pattern.exec(field.textContent);
      if (!match?.[0]) continue;
      const range = document.createRange();
      const text = document.createTreeWalker(field, NodeFilter.SHOW_TEXT);
      const end = match.index + match[0].length;
      let offset = 0;
      for (let node = text.nextNode(); node; node = text.nextNode()) {
        const next = offset + node.length;
        if (match.index >= offset && match.index < next) range.setStart(node, match.index - offset);
        if (end <= next) {
          range.setEnd(node, end - offset);
          return { range, field };
        }
        offset = next;
      }
    }
  }
  return null;
}

let highlightedEntry = null;
let pendingSearchReveal = 0;
results.addEventListener("click", (event) => {
  const link = event.target.closest("a");
  if (!link || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
  const target = document.getElementById(link.hash.slice(1));
  if (!target) return;
  event.preventDefault();
  cancelAnimationFrame(pendingSearchReveal);
  const match = findMatchRange(target, input.value);
  searchDialog.close();
  highlightedEntry?.classList.remove("search-hit");
  highlightedEntry = target;
  const focusTarget = match?.field ?? target;
  focusTarget.tabIndex = -1;
  focusTarget.focus({ preventScroll: true });
  if (location.hash !== link.hash) history.pushState(null, "", link.hash);

  const bounds = match?.range.getBoundingClientRect() ?? target.getBoundingClientRect();
  const table = match?.field.closest(".table-frame");
  if (table) {
    const frame = table.getBoundingClientRect();
    if (bounds.left < frame.left + 12 || bounds.right > frame.right - 12) {
      table.scrollLeft += bounds.left + bounds.width / 2 - frame.left - frame.width / 2;
    }
  }

  const scroller = document.scrollingElement;
  const maxScroll = scroller.scrollHeight - scroller.clientHeight;
  const landing = Math.max(0, Math.min(maxScroll, Math.round(scrollY + bounds.top - scroller.clientHeight * .4)));
  window.scrollTo({ top: landing, behavior: reduceMotion.matches ? "instant" : "smooth" });
  const started = performance.now();
  function revealMatch(now) {
    if (Math.abs(scrollY - landing) > 2 && now - started < 2500) {
      pendingSearchReveal = requestAnimationFrame(revealMatch);
      return;
    }
    target.classList.add("search-hit");
    if (!match) return;
    const rect = match.range.getBoundingClientRect();
    if (rect.bottom > 0 && rect.top < scroller.clientHeight) {
      document.dispatchEvent(new CustomEvent("careermap:circle-match", { detail: match.range }));
    }
  }
  pendingSearchReveal = requestAnimationFrame(revealMatch);
});

function openSearch() {
  contentsMenu.open = false;
  searchDialog.showModal();
  input.focus();
  input.select();
}

if (typeof searchDialog.showModal === "function") {
  findButton.hidden = false;
  findButton.addEventListener("click", openSearch);
  input.addEventListener("input", renderResults);
}
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && contentsMenu.open) {
    contentsMenu.open = false;
    contentsToggle.focus();
    return;
  }
  if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey || findButton.hidden) return;
  if (document.querySelector("dialog[open]") || event.target.closest("input, textarea, [contenteditable]")) return;
  event.preventDefault();
  openSearch();
});
