/** Builds the in-app PDF.js viewer HTML. PDF fetched by URL + auth token. */

const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";

export type ReaderMode = "scroll" | "page";

export function buildPdfViewerHtml(input: {
  pdfUrl: string;
  authToken: string;
  startPage: number;
  readMode?: ReaderMode;
}): string {
  const startPage = Math.max(1, Math.floor(input.startPage || 1));
  const readMode = input.readMode === "page" ? "page" : "scroll";
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
  }
  body.page-mode #scrollWrap { bottom: 72px; scroll-snap-type: y mandatory; }
  body.scroll-mode #scrollWrap { scroll-snap-type: none; padding-bottom: 24px; }
  .pageSlot {
    display: flex; align-items: center; justify-content: center;
    padding: 16px 12px;
  }
  body.page-mode .pageSlot { min-height: 100%; scroll-snap-align: start; }
  body.scroll-mode .pageSlot { min-height: auto; margin-bottom: 12px; }
  .pageInner { transform-origin: center center; touch-action: none; max-width: 100%; }
  canvas {
    display: block; max-width: 100%; height: auto !important;
    border-radius: 4px; box-shadow: 0 8px 24px rgba(0,0,0,.35); background: #fff;
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
    display: flex; align-items: center; justify-content: center;
  }
  button.nav:disabled { opacity: 0.45; }
  #pageInput {
    width: 64px; text-align: center; border: 1px solid #E5E7EB; border-radius: 8px;
    padding: 10px 4px; font-size: 15px; font-weight: 600; color: #2E4A62; background: #fff;
  }
  #pageTotal { color: #6B7280; font-size: 14px; white-space: nowrap; }
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
<div id="scrollWrap"></div>
<div class="bar">
  <button class="nav" id="prev" disabled aria-label="Previous page">‹</button>
  <input id="pageInput" type="number" inputmode="numeric" min="1" value="${startPage}" />
  <span id="pageTotal">/ —</span>
  <button class="go" id="goPage" type="button">Go</button>
  <button class="nav" id="next" disabled aria-label="Next page">›</button>
</div>
<script>
  pdfjsLib.GlobalWorkerOptions.workerSrc = "${PDFJS}/pdf.worker.min.js";

  var pdfUrl = '${pdfUrl}';
  var authToken = '${token}';
  var startPage = ${startPage};
  var readMode = '${readMode}';
  var pdfDoc = null;
  var totalPages = 0;
  var pageNum = startPage;
  var rendered = {};
  var zoomByPage = {};
  var pinchStartDist = 0;
  var pinchStartZoom = 1;
  var pinchPage = 0;
  var jumping = false;

  function post(type, extra) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, extra || {})));
    }
  }

  function fitScale(viewport) {
    var maxW = window.innerWidth - 24;
    var maxH = window.innerHeight - (readMode === 'page' ? 140 : 48);
    var s = Math.min(maxW / viewport.width, maxH / viewport.height, 2.4);
    return Math.max(s, 0.45);
  }

  function getZoom(num) { return zoomByPage[num] || 1; }
  function setZoom(num, z) { zoomByPage[num] = z; }

  function updateBar() {
    var prev = document.getElementById('prev');
    var next = document.getElementById('next');
    if (!prev || !next) return;
    prev.disabled = pageNum <= 1;
    next.disabled = pageNum >= totalPages;
    document.getElementById('pageInput').value = String(pageNum);
    document.getElementById('pageInput').max = String(totalPages);
    document.getElementById('pageTotal').textContent = '/ ' + totalPages;
  }

  function applyZoom(inner, num) {
    inner.style.transform = 'scale(' + getZoom(num) + ')';
  }

  function attachPinch(inner, num) {
    inner.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        pinchPage = num;
        pinchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        pinchStartZoom = getZoom(num);
      }
    }, { passive: true });
    inner.addEventListener('touchmove', function (e) {
      if (e.touches.length === 2 && pinchStartDist > 0 && pinchPage === num) {
        var dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        setZoom(num, Math.min(4, Math.max(0.5, pinchStartZoom * (dist / pinchStartDist))));
        applyZoom(inner, num);
        e.preventDefault();
      }
    }, { passive: false });
    inner.addEventListener('touchend', function () { pinchStartDist = 0; });
  }

  async function renderIntoSlot(num, slot) {
    if (!pdfDoc || !slot) return;
    if (rendered[num] && slot.querySelector('canvas')) return;
    rendered[num] = true;
    var page = await pdfDoc.getPage(num);
    var viewport = page.getViewport({ scale: fitScale(page.getViewport({ scale: 1 })) });
    var canvas = document.createElement('canvas');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    var inner = document.createElement('div');
    inner.className = 'pageInner';
    inner.appendChild(canvas);
    slot.innerHTML = '';
    slot.appendChild(inner);
    attachPinch(inner, num);
    applyZoom(inner, num);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
  }

  function buildSlots() {
    var wrap = document.getElementById('scrollWrap');
    wrap.innerHTML = '';
    rendered = {};
    for (var i = 1; i <= totalPages; i++) {
      var slot = document.createElement('div');
      slot.className = 'pageSlot';
      slot.dataset.page = String(i);
      slot.innerHTML = '<div style="color:#9CA3AF;font-size:13px;padding:20px 0">Page ' + i + '</div>';
      wrap.appendChild(slot);
    }
  }

  function notifyPage() {
    updateBar();
    post('page', { page: pageNum, total: totalPages });
  }

  function goToPage(num, smooth) {
    if (!totalPages) return;
    jumping = true;
    pageNum = Math.min(Math.max(Math.floor(num), 1), totalPages);
    notifyPage();
    var wrap = document.getElementById('scrollWrap');
    var slot = document.querySelector('.pageSlot[data-page="' + pageNum + '"]');
    if (slot && wrap) {
      if (readMode === 'page') {
        wrap.scrollTo({ top: slot.offsetTop, behavior: smooth ? 'smooth' : 'auto' });
      } else {
        wrap.scrollTo({ top: slot.offsetTop, behavior: smooth ? 'smooth' : 'auto' });
      }
      renderIntoSlot(pageNum, slot);
      [pageNum - 1, pageNum + 1].forEach(function (n) {
        if (n >= 1 && n <= totalPages) {
          var s = document.querySelector('.pageSlot[data-page="' + n + '"]');
          if (s) renderIntoSlot(n, s);
        }
      });
    }
    setTimeout(function () { jumping = false; }, smooth ? 400 : 80);
  }

  // Scroll mode: track page from scroll position for progress header.
  function detectVisiblePage() {
    if (jumping) return;
    var wrap = document.getElementById('scrollWrap');
    if (!wrap) return;
    var best = pageNum;
    var bestDist = Infinity;
    var slots = document.querySelectorAll('.pageSlot');
    var viewMid = wrap.scrollTop + wrap.clientHeight * (readMode === 'page' ? 0.35 : 0.4);
    for (var i = 0; i < slots.length; i++) {
      var s = slots[i];
      var mid = s.offsetTop + s.offsetHeight / 2;
      var dist = Math.abs(mid - viewMid);
      if (dist < bestDist) {
        bestDist = dist;
        best = Number(s.dataset.page);
      }
    }
    if (best !== pageNum) {
      pageNum = best;
      notifyPage();
      var slot = document.querySelector('.pageSlot[data-page="' + pageNum + '"]');
      if (slot) renderIntoSlot(pageNum, slot);
    }
  }

  var scrollTimer = null;
  document.getElementById('scrollWrap').addEventListener('scroll', function () {
    if (jumping) return;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () {
      if (readMode === 'page') {
        detectVisiblePage();
      } else {
        var wrap = document.getElementById('scrollWrap');
        var slots = document.querySelectorAll('.pageSlot');
        var viewBottom = wrap.scrollTop + wrap.clientHeight + 200;
        for (var i = 0; i < slots.length; i++) {
          var s = slots[i];
          if (s.offsetTop < viewBottom && s.offsetTop + s.offsetHeight > wrap.scrollTop - 200) {
            renderIntoSlot(Number(s.dataset.page), s);
          }
        }
        detectVisiblePage();
      }
    }, 150);
  }, { passive: true });

  document.getElementById('prev').onclick = function () { goToPage(pageNum - 1, true); };
  document.getElementById('next').onclick = function () { goToPage(pageNum + 1, true); };
  document.getElementById('goPage').onclick = function () {
    var v = parseInt(document.getElementById('pageInput').value, 10);
    if (!isNaN(v)) goToPage(v, true);
  };

  window.applyReaderSettings = function (opts) {
    if (opts.mode && opts.mode !== readMode) {
      readMode = opts.mode;
      document.body.className = readMode + '-mode';
      rendered = {};
      buildSlots();
      goToPage(pageNum, false);
    }
    if (opts.rerender) {
      rendered = {};
      goToPage(pageNum, false);
    }
  };

  window.addEventListener('orientationchange', function () {
    rendered = {};
    setTimeout(function () { goToPage(pageNum, false); }, 250);
  });
  window.addEventListener('resize', function () {
    rendered = {};
    setTimeout(function () { goToPage(pageNum, false); }, 150);
  });

  fetch(pdfUrl, { headers: { Authorization: 'Bearer ' + authToken } })
    .then(function (r) {
      if (!r.ok) throw new Error('Download failed (' + r.status + ')');
      return r.arrayBuffer();
    })
    .then(function (buf) { return pdfjsLib.getDocument({ data: buf }).promise; })
    .then(function (pdf) {
      pdfDoc = pdf;
      totalPages = pdf.numPages;
      document.getElementById('status').textContent = '';
      buildSlots();
      var first = Math.min(Math.max(startPage, 1), totalPages);
      post('ready', { total: totalPages, page: first });
      goToPage(first, false);
      if (readMode === 'scroll') {
        var wrap = document.getElementById('scrollWrap');
        var slots = document.querySelectorAll('.pageSlot');
        for (var j = 0; j < Math.min(5, slots.length); j++) {
          renderIntoSlot(j + 1, slots[j]);
        }
      }
    })
    .catch(function (err) {
      document.getElementById('status').textContent = 'Could not open PDF.';
      post('error', { message: String(err && err.message ? err.message : err) });
    });
</script>
</body>
</html>`;
}
