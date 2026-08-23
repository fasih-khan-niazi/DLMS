/** In-app PDF.js viewer — smooth vertical scroll + page mode. */

const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";

export type ReaderMode = "scroll" | "page";

export function buildPdfViewerHtml(input: {
  pdfUrl: string;
  authToken: string;
  startPage: number;
  readMode?: ReaderMode;
  zoomPercent?: number;
}): string {
  const startPage = Math.max(1, Math.floor(input.startPage || 1));
  const readMode = input.readMode === "page" ? "page" : "scroll";
  const zoomPercent = Math.min(200, Math.max(50, Number(input.zoomPercent) || 100));
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
  }
  body.page-mode #scrollWrap { bottom: 72px; overflow: hidden; }
  #pagesRoot {
    transform-origin: top center;
    will-change: transform;
    padding: 12px 0 32px;
  }
  body.page-mode #pagesRoot { padding: 0; height: 100%; }
  .pageSlot {
    display: flex; align-items: center; justify-content: center;
    padding: 8px 10px;
  }
  body.page-mode .pageSlot {
    display: none; height: 100%; padding: 12px;
  }
  body.page-mode .pageSlot.active { display: flex; }
  .pageInner { transform-origin: center center; touch-action: none; }
  canvas {
    display: block; max-width: 100%; height: auto !important;
    border-radius: 4px; box-shadow: 0 6px 18px rgba(0,0,0,.3); background: #fff;
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

  var pdfUrl = '${pdfUrl}';
  var authToken = '${token}';
  var startPage = ${startPage};
  var readMode = '${readMode}';
  var globalZoom = ${zoomPercent} / 100;
  var pageZoom = 1;
  var pdfDoc = null;
  var totalPages = 0;
  var pageNum = startPage;
  var pageHeight = 600;
  var rendering = {};
  var renderedBitmaps = {};
  var pinchStartDist = 0;
  var pinchStartZoom = 1;
  var scrollRaf = 0;

  function post(type, extra) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, extra || {})));
    }
  }

  function fitScale() {
    var maxW = window.innerWidth - 20;
    var maxH = window.innerHeight - (readMode === 'page' ? 120 : 24);
    return { maxW: maxW, maxH: maxH };
  }

  function applyGlobalZoom() {
    var root = document.getElementById('pagesRoot');
    if (readMode === 'scroll') {
      root.style.transform = 'scale(' + globalZoom + ')';
      root.style.width = (100 / globalZoom) + '%';
      root.style.marginLeft = ((100 - 100 / globalZoom) / 2) + '%';
    } else {
      root.style.transform = 'none';
      root.style.width = '100%';
      root.style.marginLeft = '0';
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

  async function renderPage(num) {
    if (!pdfDoc || rendering[num]) return;
    var slot = document.querySelector('.pageSlot[data-page="' + num + '"]');
    if (!slot) return;
    if (renderedBitmaps[num] && slot.querySelector('canvas')) {
      if (readMode === 'page') applyPageZoom(slot);
      return;
    }
    rendering[num] = true;
    try {
      var page = await pdfDoc.getPage(num);
      var base = page.getViewport({ scale: 1 });
      var fit = fitScale();
      var scale = Math.min(fit.maxW / base.width, fit.maxH / base.height, 2.2);
      scale = Math.max(scale, 0.5);
      var viewport = page.getViewport({ scale: scale });
      var canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      var inner = document.createElement('div');
      inner.className = 'pageInner';
      inner.appendChild(canvas);
      slot.innerHTML = '';
      slot.appendChild(inner);
      pageHeight = Math.max(pageHeight, viewport.height + 16);
      if (readMode === 'scroll') {
        slot.style.minHeight = pageHeight + 'px';
      }
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
      renderedBitmaps[num] = true;
      attachPinch(inner, num);
      if (readMode === 'page') applyPageZoom(slot);
    } finally {
      rendering[num] = false;
    }
  }

  function applyPageZoom(slot) {
    var inner = slot.querySelector('.pageInner');
    if (inner) inner.style.transform = 'scale(' + pageZoom + ')';
  }

  function attachPinch(inner, num) {
    inner.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        pinchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        pinchStartZoom = readMode === 'scroll' ? globalZoom : pageZoom;
      }
    }, { passive: true });
    inner.addEventListener('touchmove', function (e) {
      if (e.touches.length === 2 && pinchStartDist > 0) {
        var dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        var next = Math.min(2, Math.max(0.5, pinchStartZoom * (dist / pinchStartDist)));
        if (readMode === 'scroll') {
          globalZoom = next;
          applyGlobalZoom();
          post('zoom', { percent: Math.round(globalZoom * 100) });
        } else {
          pageZoom = next;
          applyPageZoom(inner.parentElement);
        }
        e.preventDefault();
      }
    }, { passive: false });
    inner.addEventListener('touchend', function () { pinchStartDist = 0; });
  }

  function buildSlots() {
    var root = document.getElementById('pagesRoot');
    root.innerHTML = '';
    renderedBitmaps = {};
    rendering = {};
    for (var i = 1; i <= totalPages; i++) {
      var slot = document.createElement('div');
      slot.className = 'pageSlot' + (i === pageNum ? ' active' : '');
      slot.dataset.page = String(i);
      if (readMode === 'scroll') slot.style.minHeight = pageHeight + 'px';
      root.appendChild(slot);
    }
    applyGlobalZoom();
  }

  function visibleRange() {
    var wrap = document.getElementById('scrollWrap');
    var top = wrap.scrollTop / globalZoom;
    var bottom = top + wrap.clientHeight / globalZoom;
    var first = Math.max(1, Math.floor(top / pageHeight) - 1);
    var last = Math.min(totalPages, Math.ceil(bottom / pageHeight) + 2);
    return { first: first, last: last };
  }

  function renderVisible() {
    if (readMode === 'page') {
      renderPage(pageNum);
      return;
    }
    var range = visibleRange();
    for (var n = range.first; n <= range.last; n++) renderPage(n);
    var mid = Math.round((range.first + range.last) / 2);
    if (mid !== pageNum && mid >= 1 && mid <= totalPages) {
      pageNum = mid;
      notifyPage();
    }
  }

  function goToPage(num) {
    pageNum = Math.min(Math.max(Math.floor(num), 1), totalPages || 1);
    pageZoom = 1;
    notifyPage();
    if (readMode === 'page') {
      document.querySelectorAll('.pageSlot').forEach(function (s) {
        s.classList.toggle('active', Number(s.dataset.page) === pageNum);
      });
      renderPage(pageNum);
    } else {
      var slot = document.querySelector('.pageSlot[data-page="' + pageNum + '"]');
      var wrap = document.getElementById('scrollWrap');
      if (slot && wrap) {
        wrap.scrollTop = slot.offsetTop * globalZoom;
      }
      renderVisible();
    }
  }

  document.getElementById('scrollWrap').addEventListener('scroll', function () {
    if (readMode !== 'scroll') return;
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
      pageZoom = 1;
      needsRebuild = true;
    }
    if (typeof opts.zoomPercent === 'number') {
      globalZoom = Math.min(2, Math.max(0.5, opts.zoomPercent / 100));
      pageZoom = readMode === 'page' ? globalZoom : pageZoom;
      if (readMode === 'page') pageZoom = opts.zoomPercent / 100;
      applyGlobalZoom();
      if (readMode === 'page') {
        var slot = document.querySelector('.pageSlot.active');
        if (slot) applyPageZoom(slot);
      }
      post('zoom', { percent: Math.round((readMode === 'page' ? pageZoom : globalZoom) * 100) });
    }
    if (opts.resetZoom) {
      globalZoom = 1;
      pageZoom = 1;
      applyGlobalZoom();
      var active = document.querySelector('.pageSlot.active');
      if (active) applyPageZoom(active);
      post('zoom', { percent: 100 });
    }
    if (needsRebuild) {
      buildSlots();
      goToPage(pageNum);
    } else if (opts.rerender) {
      renderedBitmaps = {};
      goToPage(pageNum);
    }
  };

  window.addEventListener('orientationchange', function () {
    renderedBitmaps = {};
    setTimeout(function () { goToPage(pageNum); }, 280);
  });
  window.addEventListener('resize', function () {
    renderedBitmaps = {};
    setTimeout(function () { goToPage(pageNum); }, 160);
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
      var fit = fitScale();
      var scale = Math.min(fit.maxW / vp.width, fit.maxH / vp.height, 2.2);
      pageHeight = vp.height * Math.max(scale, 0.5) + 16;
      buildSlots();
      var first = Math.min(Math.max(startPage, 1), totalPages);
      post('ready', { total: totalPages, page: first });
      goToPage(first);
    })
    .catch(function (err) {
      document.getElementById('status').textContent = 'Could not open PDF.';
      post('error', { message: String(err && err.message ? err.message : err) });
    });
</script>
</body>
</html>`;
}
