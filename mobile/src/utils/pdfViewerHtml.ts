/** In-app PDF.js viewer — continuous pinch, hi-DPI pages, free pan when zoomed. */

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
    padding: 12px 8px 40px;
    min-height: 100%;
    min-width: 100%;
    width: max-content;
    transform-origin: 0 0;
    will-change: transform;
  }
  body.page-mode #pagesRoot {
    padding: 0; height: 100%; min-height: 100%;
    width: 100%; min-width: 100%;
    transform-origin: 0 0;
  }
  .pageSlot {
    display: flex; align-items: flex-start; justify-content: flex-start;
    padding: 10px 0;
    min-width: 100%;
    width: max-content;
    box-sizing: border-box;
  }
  body.page-mode .pageSlot {
    display: none; height: 100%; width: 100%; min-width: 100%;
    align-items: flex-start; justify-content: flex-start;
    overflow: auto; -webkit-overflow-scrolling: touch;
    touch-action: pan-x pan-y;
    padding: 8px;
  }
  body.page-mode .pageSlot.active { display: flex; }
  .pageInner {
    display: inline-block;
    transform-origin: 0 0;
    will-change: transform;
  }
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
  <span id="pageTotal">/ —</span>
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
  var zoom = ${zoomPercent} / 100;
  var pdfDoc = null;
  var totalPages = 0;
  var pageNum = startPage;
  var basePageHeight = 520;
  var rendering = {};
  var renderedAt = {};
  var pinchStartDist = 0;
  var pinchStartZoom = 1;
  var pinchActive = false;
  var pinchCX = 0;
  var pinchCY = 0;
  var pinchViewX = 0;
  var pinchViewY = 0;
  var liveZoom = zoom;
  var scrollRaf = 0;
  var commitTimer = 0;

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

  function cssPageHeight() {
    return Math.max(160, Math.round(basePageHeight * zoom) + 20);
  }

  function clearLivePreview() {
    var root = document.getElementById('pagesRoot');
    root.style.transform = '';
    document.querySelectorAll('.pageInner').forEach(function (el) {
      el.style.transform = '';
    });
  }

  function scroller() {
    if (readMode === 'page') return document.querySelector('.pageSlot.active');
    return document.getElementById('scrollWrap');
  }

  function applyLivePreview(z) {
    liveZoom = clampZoom(z);
    var factor = liveZoom / zoom;
    if (readMode === 'scroll') {
      var root = document.getElementById('pagesRoot');
      root.style.transformOrigin = pinchCX + 'px ' + pinchCY + 'px';
      root.style.transform = 'scale(' + factor + ')';
    } else {
      var slot = scroller();
      var inner = slot && slot.querySelector('.pageInner');
      if (!inner) return;
      inner.style.transformOrigin = (pinchCX - inner.offsetLeft) + 'px ' + (pinchCY - inner.offsetTop) + 'px';
      inner.style.transform = 'scale(' + factor + ')';
    }
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

  function alignSlot(slot, cssW) {
    // Always left-align so zoom/scroll math stays stable (no center→left jump)
    slot.style.justifyContent = 'flex-start';
  }

  async function renderPage(num, force) {
    if (!pdfDoc || rendering[num]) return;
    var slot = document.querySelector('.pageSlot[data-page="' + num + '"]');
    if (!slot) return;
    var zoomKey = Math.round(zoom * 100);
    if (!force && renderedAt[num] === zoomKey && slot.querySelector('canvas')) {
      alignSlot(slot, slot.querySelector('canvas').clientWidth);
      return;
    }

    rendering[num] = true;
    try {
      var page = await pdfDoc.getPage(num);
      var base = page.getViewport({ scale: 1 });
      var fit = fitBaseScale();
      // Fit to screen at 100% zoom; allow higher ceiling so text stays sharp on phones
      var fitScale = Math.min(fit.maxW / base.width, fit.maxH / base.height, 3.5);
      fitScale = Math.max(fitScale, 0.55);
      var pixelRatio = dpr();
      var renderScale = fitScale * zoom * pixelRatio;
      var viewport = page.getViewport({ scale: renderScale });
      var cssW = viewport.width / pixelRatio;
      var cssH = viewport.height / pixelRatio;

      var canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';

      var ctx = canvas.getContext('2d', { alpha: false });
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
      }

      var inner = document.createElement('div');
      inner.className = 'pageInner';
      inner.appendChild(canvas);

      if (readMode === 'scroll') {
        slot.style.minHeight = Math.round(cssH + 20) + 'px';
        if (num === 1) basePageHeight = cssH / zoom;
      }

      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      // Swap only after paint so we never flash an empty/black slot
      var prev = slot.querySelector('.pageInner');
      if (prev) slot.replaceChild(inner, prev);
      else slot.appendChild(inner);
      alignSlot(slot, cssW);
      renderedAt[num] = zoomKey;
    } finally {
      rendering[num] = false;
    }
  }

  function buildSlots() {
    var root = document.getElementById('pagesRoot');
    root.innerHTML = '';
    renderedAt = {};
    rendering = {};
    clearLivePreview();
    var h = cssPageHeight();
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
    var h = cssPageHeight();
    var top = wrap.scrollTop;
    var bottom = top + wrap.clientHeight;
    return {
      first: Math.max(1, Math.floor(top / h) - 1),
      last: Math.min(totalPages, Math.ceil(bottom / h) + 2)
    };
  }

  function renderVisible(force) {
    if (readMode === 'page') {
      renderPage(pageNum, force);
      return;
    }
    var range = visibleRange();
    for (var n = range.first; n <= range.last; n++) renderPage(n, force);
    var h = cssPageHeight();
    var wrap = document.getElementById('scrollWrap');
    var mid = Math.min(totalPages, Math.max(1, Math.round((wrap.scrollTop + wrap.clientHeight * 0.35) / h) + 1));
    if (mid !== pageNum) {
      pageNum = mid;
      notifyPage();
    }
  }

  function enableFreePan(opts) {
    opts = opts || {};
    var el = scroller();
    if (!el) return;
    if (opts.resetPage && readMode === 'scroll') {
      el.scrollTop = (pageNum - 1) * cssPageHeight();
      el.scrollLeft = 0;
    }
    if (opts.resetOrigin && readMode === 'page') {
      el.scrollLeft = 0;
      el.scrollTop = 0;
    }
  }

  /** Keep the same content point under the fingers after zoom changes size. */
  function scrollToPinchFocus(oldZoom, newZoom, viewX, viewY) {
    var el = scroller();
    if (!el) return;
    var ratio = newZoom / oldZoom;
    el.scrollLeft = Math.max(0, pinchCX * ratio - viewX);
    el.scrollTop = Math.max(0, pinchCY * ratio - viewY);
  }

  function commitZoom(next, opts) {
    opts = opts || {};
    var oldZoom = zoom;
    var target = clampZoom(next);
    if (Math.abs(target - oldZoom) < 0.001 && !opts.force) {
      clearLivePreview();
      liveZoom = zoom;
      return;
    }

    zoom = target;
    liveZoom = zoom;
    post('zoom', { percent: Math.round(zoom * 100) });

    if (readMode === 'scroll') {
      document.querySelectorAll('.pageSlot').forEach(function (s) {
        s.style.minHeight = cssPageHeight() + 'px';
      });
    }

    clearLivePreview();

    if (opts.fromPinch) {
      scrollToPinchFocus(oldZoom, zoom, pinchViewX, pinchViewY);
      renderVisible(true);
    } else if (opts.keepPage) {
      if (readMode === 'scroll') enableFreePan({ resetPage: true });
      else enableFreePan({ resetOrigin: true });
      renderVisible(true);
    } else {
      renderVisible(true);
      if (opts.resetOrigin) enableFreePan({ resetOrigin: true, resetPage: true });
    }
  }

  function goToPage(num, resetPageZoom) {
    pageNum = Math.min(Math.max(Math.floor(num), 1), totalPages || 1);
    if (readMode === 'page') {
      if (resetPageZoom !== false) {
        zoom = 1;
        liveZoom = 1;
        clearLivePreview();
        post('zoom', { percent: 100 });
      }
      document.querySelectorAll('.pageSlot').forEach(function (s) {
        s.classList.toggle('active', Number(s.dataset.page) === pageNum);
      });
      notifyPage();
      renderPage(pageNum, true);
      enableFreePan();
    } else {
      notifyPage();
      var wrap = document.getElementById('scrollWrap');
      wrap.scrollTop = (pageNum - 1) * cssPageHeight();
      renderVisible(false);
    }
  }

  function onTouchStart(e) {
    if (e.touches.length === 2) {
      pinchActive = true;
      var el = scroller();
      if (!el) return;
      var rect = el.getBoundingClientRect();
      var mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      var my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      pinchViewX = mx - rect.left;
      pinchViewY = my - rect.top;
      pinchCX = el.scrollLeft + pinchViewX;
      pinchCY = el.scrollTop + pinchViewY;
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
    applyLivePreview(pinchStartZoom * (dist / pinchStartDist));
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
      renderVisible(false);
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
      zoom = 1;
      liveZoom = 1;
      needsRebuild = true;
    }
    if (opts.resetZoom) {
      if (needsRebuild) {
        zoom = 1;
        liveZoom = 1;
      } else {
        commitZoom(1, { keepPage: true });
      }
    } else if (typeof opts.zoomPercent === 'number') {
      if (needsRebuild) {
        zoom = clampZoom(opts.zoomPercent / 100);
        liveZoom = zoom;
      } else {
        commitZoom(opts.zoomPercent / 100, { keepPage: true });
      }
    }
    if (needsRebuild) {
      post('zoom', { percent: Math.round(zoom * 100) });
      buildSlots();
      goToPage(pageNum, false);
      enableFreePan();
    }
  };

  window.addEventListener('orientationchange', function () {
    renderedAt = {};
    setTimeout(function () { renderVisible(true); enableFreePan(); }, 280);
  });
  window.addEventListener('resize', function () {
    renderedAt = {};
    setTimeout(function () { renderVisible(true); enableFreePan(); }, 160);
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
