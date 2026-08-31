/** In-app PDF.js viewer. Continuous pinch without re-render flash, hi-DPI buffers. */

const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";

export type ReaderMode = "scroll" | "page";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;

export function buildPdfViewerHtml(input: {
  pdfUrl: string;
  authToken: string;
  startPage: number;
  readMode?: ReaderMode;
  zoomPercent?: number;
}): string {
  const startPage = Math.max(1, Math.floor(input.startPage || 1));
  const readMode = input.readMode === "page" ? "page" : "scroll";
  const zoomPercent = Math.min(250, Math.max(50, Number(input.zoomPercent) || 100));
  const pdfUrl = input.pdfUrl.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const token = input.authToken.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<script src="${PDFJS}/pdf.min.js"></script>
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { margin: 0; height: 100%; background: #1a2a38; font-family: system-ui, sans-serif; overflow: hidden; }
  #scrollWrap {
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    overflow: auto; -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    touch-action: pan-x pan-y;
  }
  body.page-mode #scrollWrap { bottom: 72px; }
  #pagesRoot {
    padding: 12px 0 40px;
    min-height: 100%;
    min-width: 100%;
    width: max-content;
  }
  body.page-mode #pagesRoot {
    padding: 0; height: 100%; min-height: 100%;
    width: 100%; min-width: 100%;
  }
  .pageSlot {
    display: flex; align-items: flex-start; justify-content: center;
    padding: 10px 8px;
    min-width: 100%;
    width: max-content;
    box-sizing: border-box;
  }
  body.page-mode .pageSlot {
    display: none; height: 100%; width: 100%; min-width: 100%;
    /* flex-start so zoomed pages can scroll to every edge (center clips the left) */
    align-items: flex-start; justify-content: flex-start;
    overflow: auto; -webkit-overflow-scrolling: touch;
    touch-action: pan-x pan-y;
    padding: 0;
  }
  body.page-mode .pageSlot.active { display: flex; }
  .pageInner { display: inline-block; }
  body.page-mode .pageInner { margin: 0; }
  canvas {
    display: block;
    border-radius: 4px;
    box-shadow: 0 6px 18px rgba(0,0,0,.3);
    background: #fff;
    image-rendering: -webkit-optimize-contrast;
  }
  .bar {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 10;
    background: #F8F7F4; border-top: 1px solid #E5E7EB;
    padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
    display: none; align-items: center; justify-content: center; gap: 10px;
  }
  body.page-mode .bar { display: flex; }
  button.nav {
    background: #2E4A62; color: #fff; border: none; border-radius: 10px;
    width: 44px; height: 44px; font-size: 22px; font-weight: 600;
  }
  button.nav:disabled { opacity: 0.45; }
  #pageInput {
    width: 64px; text-align: center; border: 1px solid #E5E7EB; border-radius: 8px;
    padding: 10px 4px; font-size: 15px; font-weight: 600; color: #2E4A62; background: #fff;
  }
  #pageTotal { color: #6B7280; font-size: 14px; }
  button.go {
    background: #E8A838; color: #2E4A62; border: none; border-radius: 10px;
    padding: 10px 14px; font-size: 14px; font-weight: 700;
  }
  #status {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
    color: #fff; font-size: 14px; text-align: center; padding: 12px; z-index: 5;
  }
</style>
</head>
<body class="${readMode}-mode">
<div id="status">Opening book…</div>
<div id="scrollWrap"><div id="pagesRoot"></div></div>
<div class="bar">
  <button class="nav" id="prev" disabled>‹</button>
  <input id="pageInput" type="number" inputmode="numeric" min="1" value="${startPage}" />
  <span id="pageTotal">/ -</span>
  <button class="go" id="goPage" type="button">Go</button>
  <button class="nav" id="next" disabled>›</button>
</div>
<script>
  pdfjsLib.GlobalWorkerOptions.workerSrc = "${PDFJS}/pdf.worker.min.js";

  var MIN_Z = ${MIN_ZOOM};
  var MAX_Z = ${MAX_ZOOM};
  var pdfUrl = '${pdfUrl}';
  var authToken = '${token}';
  var startPage = ${startPage};
  var readMode = '${readMode}';
  var baseSettingsZoom = ${zoomPercent} / 100;
  var currentZoom = baseSettingsZoom;
  var zoom = baseSettingsZoom;
  var pdfDoc = null;
  var totalPages = 0;
  var pageNum = startPage;
  var basePageHeight = 520;
  var rendering = {};
  var rendered = {};
  var pinchStartDist = 0;
  var pinchStartZoom = 1;
  var pinchActive = false;
  var focusPage = startPage;
  var focusFracX = 0.5;
  var focusFracY = 0.5;
  var focusScreenX = 0;
  var focusScreenY = 0;
  var liveZoom = baseSettingsZoom;
  var scrollRaf = 0;
  var commitTimer = 0;
  var sizeRaf = 0;

  function clampZoom(z) { return Math.min(MAX_Z, Math.max(MIN_Z, z)); }
  function dpr() { return Math.min(window.devicePixelRatio || 2, 4); }

  function post(type, extra) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, extra || {})));
    }
  }

  function fitBaseScale() {
    var maxW = Math.max(window.innerWidth - 24, 120);
    var maxH = Math.max(window.innerHeight - (readMode === 'page' ? 100 : 32), 160);
    return { maxW: maxW, maxH: maxH };
  }

  function cssPageHeight(z) {
    z = z == null ? currentZoom : z;
    return Math.max(160, Math.round(basePageHeight * z) + 20);
  }

  function scroller() {
    if (readMode === 'page') return document.querySelector('.pageSlot.active');
    return document.getElementById('scrollWrap');
  }

  function pageCanvas(num) {
    return document.querySelector('.pageSlot[data-page="' + num + '"] canvas');
  }

  function canvasAtPoint(mx, my) {
    var nodes = document.querySelectorAll('.pageSlot canvas');
    for (var i = 0; i < nodes.length; i++) {
      var r = nodes[i].getBoundingClientRect();
      if (mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom) return nodes[i];
    }
    return pageCanvas(pageNum);
  }

  /** Resize existing canvases only, no PDF.js redraw (avoids shimmer). */
  function applyZoomSizes(z) {
    z = clampZoom(z);
    document.querySelectorAll('.pageSlot canvas').forEach(function (c) {
      var bw = Number(c.dataset.baseW) || 0;
      var bh = Number(c.dataset.baseH) || 0;
      if (!bw || !bh) return;
      c.style.width = (bw * z) + 'px';
      c.style.height = (bh * z) + 'px';
    });
    if (readMode === 'scroll') {
      var h = cssPageHeight(z);
      document.querySelectorAll('.pageSlot').forEach(function (s) {
        var c = s.querySelector('canvas');
        if (c && c.dataset.baseH) {
          s.style.minHeight = Math.round(Number(c.dataset.baseH) * z + 20) + 'px';
        } else {
          s.style.minHeight = h + 'px';
        }
      });
    } else {
      layoutPageMode();
    }
  }

  /**
   * Page mode: keep the page visually centered when it fits, but when zoomed
   * larger than the viewport use top-left layout + scroll so every edge is reachable.
   * (justify-content:center makes the left overflow unreachable.)
   */
  function layoutPageMode() {
    if (readMode !== 'page') return;
    var slot = document.querySelector('.pageSlot.active');
    if (!slot) return;
    var inner = slot.querySelector('.pageInner');
    var canvas = slot.querySelector('canvas');
    if (!inner || !canvas) return;

    slot.style.justifyContent = 'flex-start';
    slot.style.alignItems = 'flex-start';

    var padX = Math.max(0, (slot.clientWidth - canvas.offsetWidth) / 2);
    var padY = Math.max(0, (slot.clientHeight - canvas.offsetHeight) / 2);
    inner.style.marginLeft = padX + 'px';
    inner.style.marginRight = padX + 'px';
    inner.style.marginTop = padY + 'px';
    inner.style.marginBottom = padY + 'px';
  }

  function setFocusFromScreen(mx, my, canvas) {
    if (!canvas) {
      focusFracX = 0.5;
      focusFracY = 0.5;
      focusPage = pageNum;
      focusScreenX = mx;
      focusScreenY = my;
      return;
    }
    var r = canvas.getBoundingClientRect();
    var slot = canvas.closest('.pageSlot');
    focusPage = slot ? Number(slot.dataset.page) || pageNum : pageNum;
    focusFracX = r.width ? (mx - r.left) / r.width : 0.5;
    focusFracY = r.height ? (my - r.top) / r.height : 0.5;
    focusFracX = Math.min(1, Math.max(0, focusFracX));
    focusFracY = Math.min(1, Math.max(0, focusFracY));
    focusScreenX = mx;
    focusScreenY = my;
  }

  function pinFocusToScreen() {
    var canvas = pageCanvas(focusPage);
    var el = scroller();
    if (!canvas || !el) return;
    var r = canvas.getBoundingClientRect();
    var atX = r.left + focusFracX * r.width;
    var atY = r.top + focusFracY * r.height;
    el.scrollLeft += (atX - focusScreenX);
    el.scrollTop += (atY - focusScreenY);
  }

  /** Absolute zoom from settings: show current page centered in the viewport. */
  function centerPageInView(num) {
    var canvas = pageCanvas(num || pageNum);
    var el = scroller();
    if (!canvas || !el) return;
    var elRect = el.getBoundingClientRect();
    var cRect = canvas.getBoundingClientRect();
    el.scrollLeft += (cRect.left + cRect.width / 2) - (elRect.left + el.clientWidth / 2);
    el.scrollTop += (cRect.top + cRect.height / 2) - (elRect.top + el.clientHeight / 2);
  }

  function updateBar() {
    document.getElementById('prev').disabled = pageNum <= 1;
    document.getElementById('next').disabled = pageNum >= totalPages;
    document.getElementById('pageInput').value = String(pageNum);
    document.getElementById('pageInput').max = String(totalPages);
    document.getElementById('pageTotal').textContent = '/ ' + totalPages;
  }

  function notifyPage() {
    updateBar();
    post('page', { page: pageNum, total: totalPages });
  }

  async function renderPage(num) {
    if (!pdfDoc || rendering[num]) return;
    var slot = document.querySelector('.pageSlot[data-page="' + num + '"]');
    if (!slot) return;
    if (rendered[num] && slot.querySelector('canvas')) return;

    rendering[num] = true;
    try {
      var page = await pdfDoc.getPage(num);
      var base = page.getViewport({ scale: 1 });
      var fit = fitBaseScale();
      var fitScale = Math.min(fit.maxW / base.width, fit.maxH / base.height, 3.5);
      fitScale = Math.max(fitScale, 0.55);
      var pixelRatio = dpr();
      // Bitmap is sharp up to max zoom; display size follows current zoom (CSS only)
      var renderScale = fitScale * MAX_Z * pixelRatio;
      var viewport = page.getViewport({ scale: renderScale });
      var baseW = (viewport.width / pixelRatio) / MAX_Z;
      var baseH = (viewport.height / pixelRatio) / MAX_Z;

      var canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.dataset.baseW = String(baseW);
      canvas.dataset.baseH = String(baseH);
      canvas.style.width = (baseW * zoom) + 'px';
      canvas.style.height = (baseH * zoom) + 'px';

      var ctx = canvas.getContext('2d', { alpha: false });
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
      }

      var inner = document.createElement('div');
      inner.className = 'pageInner';
      inner.appendChild(canvas);

      if (readMode === 'scroll') {
        slot.style.minHeight = Math.round(baseH * zoom + 20) + 'px';
        if (num === 1) basePageHeight = baseH;
      }

      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      var prev = slot.querySelector('.pageInner');
      if (prev) slot.replaceChild(inner, prev);
      else slot.appendChild(inner);
      if (readMode === 'scroll') {
        slot.style.justifyContent = 'center';
      } else {
        layoutPageMode();
      }
      rendered[num] = true;
    } finally {
      rendering[num] = false;
    }
  }

  function buildSlots() {
    var root = document.getElementById('pagesRoot');
    root.innerHTML = '';
    rendered = {};
    rendering = {};
    var h = cssPageHeight(currentZoom);
    for (var i = 1; i <= totalPages; i++) {
      var slot = document.createElement('div');
      slot.className = 'pageSlot' + (i === pageNum ? ' active' : '');
      slot.dataset.page = String(i);
      if (readMode === 'scroll') slot.style.minHeight = h + 'px';
      root.appendChild(slot);
    }
  }

  function visibleRange() {
    var wrap = document.getElementById('scrollWrap');
    var h = cssPageHeight(currentZoom);
    var top = wrap.scrollTop;
    var bottom = top + wrap.clientHeight;
    return {
      first: Math.max(1, Math.floor(top / h) - 1),
      last: Math.min(totalPages, Math.ceil(bottom / h) + 2)
    };
  }

  function renderVisible() {
    if (readMode === 'page') {
      return Promise.resolve(renderPage(pageNum));
    }
    var range = visibleRange();
    var jobs = [];
    for (var n = range.first; n <= range.last; n++) jobs.push(renderPage(n));
    var h = cssPageHeight(currentZoom);
    var wrap = document.getElementById('scrollWrap');
    var mid = Math.min(totalPages, Math.max(1, Math.round((wrap.scrollTop + wrap.clientHeight * 0.35) / h) + 1));
    if (mid !== pageNum) {
      pageNum = mid;
      notifyPage();
    }
    return Promise.all(jobs);
  }

  function commitZoom(next, opts) {
    opts = opts || {};
    var target = clampZoom(next);
    currentZoom = target;
    liveZoom = currentZoom;
    if (readMode === 'scroll' || !opts.fromPinch) {
      baseSettingsZoom = target;
    }
    applyZoomSizes(currentZoom);
    post('zoom', { percent: Math.round(currentZoom * 100) });

    requestAnimationFrame(function () {
      if (readMode === 'page') layoutPageMode();
      if (opts.fromPinch) {
        pinFocusToScreen();
      } else {
        // Settings pills: absolute zoom as if from 100%, page centered. One step, no reset flash
        centerPageInView(pageNum);
      }
    });
  }

  function goToPage(num) {
    pageNum = Math.min(Math.max(Math.floor(num), 1), totalPages || 1);
    if (readMode === 'page') {
      // In page-by-page mode: reset temporary page pinch zoom back to the zoom set in settings
      currentZoom = baseSettingsZoom;
      liveZoom = baseSettingsZoom;
      applyZoomSizes(baseSettingsZoom);
      post('zoom', { percent: Math.round(baseSettingsZoom * 100) });

      document.querySelectorAll('.pageSlot').forEach(function (s) {
        s.classList.toggle('active', Number(s.dataset.page) === pageNum);
      });
      notifyPage();
      Promise.resolve(renderPage(pageNum)).then(function () {
        layoutPageMode();
        centerPageInView(pageNum);
      });
    } else {
      notifyPage();
      var wrap = document.getElementById('scrollWrap');
      wrap.scrollTop = (pageNum - 1) * cssPageHeight(currentZoom);
      renderVisible();
    }
  }

  function onTouchStart(e) {
    if (e.touches.length === 2) {
      pinchActive = true;
      var mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      var my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      setFocusFromScreen(mx, my, canvasAtPoint(mx, my));
      pinchStartDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      ) || 1;
      pinchStartZoom = liveZoom;
      if (commitTimer) {
        clearTimeout(commitTimer);
        commitTimer = 0;
      }
    }
  }

  function onTouchMove(e) {
    if (!pinchActive || e.touches.length !== 2) return;
    e.preventDefault();
    var dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    liveZoom = clampZoom(pinchStartZoom * (dist / pinchStartDist));
    if (sizeRaf) return;
    sizeRaf = requestAnimationFrame(function () {
      sizeRaf = 0;
      applyZoomSizes(liveZoom);
      pinFocusToScreen();
    });
  }

  function onTouchEnd(e) {
    if (e.touches.length >= 2) return;
    if (!pinchActive) return;
    pinchActive = false;
    pinchStartDist = 0;
    var finalZoom = liveZoom;
    commitTimer = setTimeout(function () {
      commitTimer = 0;
      commitZoom(finalZoom, { fromPinch: true });
    }, 16);
  }

  var wrapEl = document.getElementById('scrollWrap');
  wrapEl.addEventListener('touchstart', onTouchStart, { passive: true });
  wrapEl.addEventListener('touchmove', onTouchMove, { passive: false });
  wrapEl.addEventListener('touchend', onTouchEnd, { passive: true });
  wrapEl.addEventListener('touchcancel', onTouchEnd, { passive: true });

  wrapEl.addEventListener('scroll', function () {
    if (readMode !== 'scroll' || pinchActive) return;
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(function () {
      scrollRaf = 0;
      renderVisible();
    });
  }, { passive: true });

  document.getElementById('prev').onclick = function () { goToPage(pageNum - 1); };
  document.getElementById('next').onclick = function () { goToPage(pageNum + 1); };
  document.getElementById('goPage').onclick = function () {
    var v = parseInt(document.getElementById('pageInput').value, 10);
    if (!isNaN(v)) goToPage(v);
  };

  window.applyReaderSettings = function (opts) {
    var needsRebuild = false;
    if (opts.mode && opts.mode !== readMode) {
      readMode = opts.mode;
      document.body.className = readMode + '-mode';
      baseSettingsZoom = 1;
      currentZoom = 1;
      liveZoom = 1;
      needsRebuild = true;
    }
    if (opts.resetZoom) {
      baseSettingsZoom = 1;
      currentZoom = 1;
      liveZoom = 1;
      if (!needsRebuild) {
        commitZoom(1, { keepPage: true });
      }
    } else if (typeof opts.zoomPercent === 'number') {
      baseSettingsZoom = clampZoom(opts.zoomPercent / 100);
      currentZoom = baseSettingsZoom;
      liveZoom = currentZoom;
      if (!needsRebuild) {
        commitZoom(baseSettingsZoom, { keepPage: true });
      }
    }
    if (needsRebuild) {
      post('zoom', { percent: Math.round(baseSettingsZoom * 100) });
      buildSlots();
      goToPage(pageNum);
    }
  };

  window.addEventListener('orientationchange', function () {
    rendered = {};
    setTimeout(function () {
      applyZoomSizes(currentZoom);
      renderVisible();
    }, 280);
  });
  window.addEventListener('resize', function () {
    rendered = {};
    setTimeout(function () {
      applyZoomSizes(currentZoom);
      renderVisible();
    }, 160);
  });

  fetch(pdfUrl, { headers: { Authorization: 'Bearer ' + authToken } })
    .then(function (r) {
      if (!r.ok) throw new Error('Download failed (' + r.status + ')');
      return r.arrayBuffer();
    })
    .then(function (buf) { return pdfjsLib.getDocument({ data: buf }).promise; })
    .then(async function (pdf) {
      pdfDoc = pdf;
      totalPages = pdf.numPages;
      document.getElementById('status').textContent = '';
      var firstPage = await pdf.getPage(1);
      var vp = firstPage.getViewport({ scale: 1 });
      var fit = fitBaseScale();
      var scale = Math.min(fit.maxW / vp.width, fit.maxH / vp.height, 2.8);
      basePageHeight = vp.height * Math.max(scale, 0.5);
      buildSlots();
      var first = Math.min(Math.max(startPage, 1), totalPages);
      post('ready', { total: totalPages, page: first });
      post('zoom', { percent: Math.round(zoom * 100) });
      goToPage(first, false);
    })
    .catch(function (err) {
      document.getElementById('status').textContent = 'Could not open PDF.';
      post('error', { message: String(err && err.message ? err.message : err) });
    });
</script>
</body>
</html>`;
}
