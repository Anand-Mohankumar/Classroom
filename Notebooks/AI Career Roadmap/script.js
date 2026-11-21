"use strict";

const root = document.documentElement;
const chapters = [...document.querySelectorAll("[data-chapter]")];
const chapterLinks = [...document.querySelectorAll("[data-chapter-link]")];
const contentsMenu = document.querySelector(".contents-menu");
const contentsToggle = contentsMenu.querySelector("summary");
const readingLine = document.querySelector(".reading-line");
const backToTop = document.querySelector(".back-to-top");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (root.classList.contains("is-opening")) {
  const book = document.querySelector(".book");
  const cover = book.querySelector(".cover");
  const openingHash = location.hash;
  const listeners = new AbortController();
  const options = { signal: listeners.signal, passive: true, capture: true };
  let fallback;
  let openingFrame;

  function sizeOpening() {
    const { offsetLeft: left, offsetTop: top, offsetWidth: width } = book;
    const { clientWidth, clientHeight } = root;
    // Keep the edge of the temporary page below the viewport at the end of the zoom.
    const pageHeight = Math.max(cover.offsetHeight, width * 1.08, clientHeight - top + 36);
    const widthLimit = window.matchMedia("(max-width: 42rem)").matches ? .72 : .5;
    const scale = Math.min(clientWidth * widthLimit / width, clientHeight * .64 / pageHeight);
    openingFrame = {
      "--opening-height": `${pageHeight}px`,
      "--opening-scale": scale,
      "--opening-x": `${(clientWidth - width * scale) / 2 - left}px`,
      "--opening-y": `${(clientHeight - pageHeight * scale) / 2 - top}px`,
    };
    for (const [property, value] of Object.entries(openingFrame)) book.style.setProperty(property, value);
  }

  function syncOpeningVisibility() {
    root.classList.toggle("is-opening-paused", document.hidden);
    clearTimeout(fallback);
    sizeOpening();
    if (!document.hidden) fallback = setTimeout(finishOpening, 3200);
  }

  function finishOpening({ restoreChapter = true } = {}) {
    root.classList.remove("is-opening", "is-opening-ready", "is-opening-paused");
    clearTimeout(fallback);
    listeners.abort();
    for (const property of Object.keys(openingFrame)) book.style.removeProperty(property);
    if (restoreChapter && openingHash && openingHash !== "#top" && location.hash === openingHash) {
      document.getElementById(openingHash.slice(1))?.scrollIntoView({ behavior: "instant" });
    }
  }

  function keepOpeningAtTop() {
    if (window.scrollY !== 0) window.scrollTo({ top: 0, behavior: "instant" });
  }

  book.addEventListener("animationend", (event) => {
    if (event.target === book && event.animationName === "approach-book") finishOpening();
  }, options);
  for (const type of ["pointerdown", "keydown", "wheel", "touchstart"]) {
    window.addEventListener(type, finishOpening, options);
  }
  document.addEventListener("visibilitychange", syncOpeningVisibility, options);
  window.addEventListener("resize", sizeOpening, options);
  reduceMotion.addEventListener("change", finishOpening, options);
  window.addEventListener("scroll", keepOpeningAtTop, options);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) finishOpening({ restoreChapter: false });
    else keepOpeningAtTop();
  }, options);

  keepOpeningAtTop();
  syncOpeningVisibility();
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

const map = document.querySelector(".map-art");
const mapImage = map.querySelector("img");
const lens = map.querySelector(".map-lens");
map.style.setProperty("--lens-image", "url(" + mapImage.getAttribute("src") + ")");

function showLens(clientX, clientY) {
  const bounds = map.getBoundingClientRect();
  const diameter = lens.offsetWidth;
  const halfGlass = diameter * .455;
  const x = Math.max(diameter * .24, Math.min(bounds.width - diameter * .24, clientX - bounds.left));
  const y = Math.max(diameter * .24, Math.min(bounds.height - diameter * .24, clientY - bounds.top));
  const scale = 1.9;
  const width = bounds.width * scale;
  const height = bounds.height * scale;
  const offsetX = Math.min(0, Math.max(halfGlass * 2 - width, halfGlass - x * scale));
  const offsetY = Math.min(0, Math.max(halfGlass * 2 - height, halfGlass - y * scale));
  map.style.setProperty("--map-x", x + "px");
  map.style.setProperty("--map-y", y + "px");
  map.style.setProperty("--lens-size", width + "px " + height + "px");
  map.style.setProperty("--lens-offset", offsetX + "px " + offsetY + "px");
  map.classList.add("is-examining");
  return { x: bounds.left + x, y: bounds.top + y };
}

function centerLens(link) {
  const bounds = link.getBoundingClientRect();
  return showLens(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
}

function hideLens() {
  if (!map.classList.contains("is-entering")) map.classList.remove("is-examining");
}

map.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch" || map.classList.contains("is-entering") || root.classList.contains("is-inking")) return;
  if (event.target.closest(".map-link")) {
    showLens(event.clientX, event.clientY);
  } else {
    hideLens();
  }
});
map.addEventListener("pointerleave", hideLens);
map.addEventListener("focusin", (event) => {
  if (event.target.matches(".map-link:focus-visible")) centerLens(event.target);
});
map.addEventListener("focusout", hideLens);

function goToChapter(link, chapter, behavior) {
  history.pushState(null, "", link.hash);
  const heading = chapter.querySelector("h2");
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
  chapter.scrollIntoView({ behavior });
}

map.addEventListener("click", async (event) => {
  const link = event.target.closest(".map-link");
  if (!link || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || reduceMotion.matches) return;
  const chapter = document.getElementById(link.hash.slice(1));
  if (!chapter) return;

  event.preventDefault();
  if (map.classList.contains("is-entering")) return;

  const origin = event.detail ? showLens(event.clientX, event.clientY) : centerLens(link);
  await new Promise((resolve) => requestAnimationFrame(resolve));
  map.classList.add("is-entering");
  await new Promise((resolve) => setTimeout(resolve, 290));

  try {
    if (typeof document.startViewTransition !== "function") {
      goToChapter(link, chapter, "smooth");
      return;
    }
    root.style.setProperty("--reveal-x", origin.x + "px");
    root.style.setProperty("--reveal-y", origin.y + "px");
    root.classList.add("map-travel");
    const travel = document.startViewTransition(() => goToChapter(link, chapter, "instant"));
    await travel.finished;
  } catch {
    if (location.hash !== link.hash) goToChapter(link, chapter, "smooth");
  } finally {
    root.classList.remove("map-travel");
    map.classList.remove("is-entering", "is-examining");
  }
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
  const entries = chapter.querySelectorAll("h2, h3, h4, p, li, tbody tr");
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
