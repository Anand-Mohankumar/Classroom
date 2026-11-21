"use strict";

(() => {
  const viewer = document.querySelector(".figure-viewer");
  if (typeof viewer.showModal !== "function") return;

  const stage = viewer.querySelector(".figure-viewer-stage");
  const image = stage.querySelector("img");
  const title = viewer.querySelector("h2");
  const status = viewer.querySelector(".figure-viewer-status");
  const zoomOut = viewer.querySelector("[data-zoom-out]");
  const zoomIn = viewer.querySelector("[data-zoom-in]");
  const resetZoom = viewer.querySelector("[data-zoom-fit]");
  const fullscreen = viewer.querySelector("[data-fullscreen]");
  const zoomLevels = [1, 1.5, 2, 3, 4, 6, 8];
  let zoomIndex = 0;
  let opener;
  let openedFullscreen = false;

  function showStatus(message) {
    status.textContent = message;
    status.hidden = !message;
  }

  function sizeImage() {
    const loaded = viewer.open && image.complete && image.naturalWidth > 0;
    zoomOut.disabled = !loaded || zoomIndex === 0;
    zoomIn.disabled = !loaded || zoomIndex === zoomLevels.length - 1;
    resetZoom.disabled = !loaded;
    if (!loaded) return;

    const padding = getComputedStyle(image.parentElement);
    const availableWidth = stage.clientWidth - parseFloat(padding.paddingLeft) - parseFloat(padding.paddingRight);
    const availableHeight = stage.clientHeight - parseFloat(padding.paddingTop) - parseFloat(padding.paddingBottom);
    const fit = Math.min(1, availableWidth / image.naturalWidth, availableHeight / image.naturalHeight);
    image.style.width = Math.max(1, Math.floor(image.naturalWidth * fit * zoomLevels[zoomIndex])) + "px";
  }

  function setZoom(nextIndex) {
    if (!image.naturalWidth || nextIndex < 0 || nextIndex >= zoomLevels.length) return;
    const before = image.getBoundingClientRect();
    const viewport = stage.getBoundingClientRect();
    const centerX = (viewport.left + stage.clientWidth / 2 - before.left) / before.width;
    const centerY = (viewport.top + stage.clientHeight / 2 - before.top) / before.height;

    zoomIndex = nextIndex;
    sizeImage();
    if (zoomIndex === 0) {
      stage.scrollTo(0, 0);
      return;
    }
    const after = image.getBoundingClientRect();
    stage.scrollBy(
      after.left + centerX * after.width - viewport.left - stage.clientWidth / 2,
      after.top + centerY * after.height - viewport.top - stage.clientHeight / 2
    );
  }

  document.querySelector(".book").addEventListener("click", (event) => {
    const link = event.target.closest(".figure-detail");
    if (!link || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();

    opener = link;
    const preview = link.querySelector("img");
    const number = preview.alt.match(/lecture figure (\d+)$/i);
    title.textContent = number ? "Figure " + number[1] : "Illustration";
    image.alt = preview.alt;
    zoomIndex = 0;
    showStatus("");
    viewer.showModal();
    image.src = link.href;
    sizeImage();
    stage.scrollTo(0, 0);
  });

  image.addEventListener("load", sizeImage);
  image.addEventListener("error", () => {
    if (!viewer.open || !image.hasAttribute("src")) return;
    showStatus("Could not load this figure.");
    sizeImage();
  });
  new ResizeObserver(sizeImage).observe(stage);
  zoomOut.addEventListener("click", () => setZoom(zoomIndex - 1));
  zoomIn.addEventListener("click", () => setZoom(zoomIndex + 1));
  resetZoom.addEventListener("click", () => setZoom(0));
  viewer.querySelector("[data-figure-close]").addEventListener("click", () => viewer.close());

  fullscreen.hidden = !document.fullscreenEnabled || !document.documentElement.requestFullscreen;
  fullscreen.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
        if (viewer.open) openedFullscreen = true;
        else await document.exitFullscreen();
      }
    } catch {
      showStatus("Browser full screen is unavailable. You can still zoom and scroll here.");
    }
  });
  document.addEventListener("fullscreenchange", () => {
    fullscreen.textContent = document.fullscreenElement ? "Exit full screen" : "Full screen";
    if (!document.fullscreenElement) openedFullscreen = false;
  });
  viewer.addEventListener("close", () => {
    if (openedFullscreen && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    image.removeAttribute("src");
    image.style.removeProperty("width");
    opener?.focus({ preventScroll: true });
  });
})();
