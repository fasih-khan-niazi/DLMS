/** Builds the in-app PDF.js viewer HTML. PDF is fetched by URL + auth token (not base64). */

const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";

export function buildPdfViewerHtml(input: {
  pdfUrl: string;
  authToken: string;
  startPage: number;
}): string {
  const startPage = Math.max(1, Math.floor(input.startPage || 1));
  const pdfUrl = input.pdfUrl.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const token = input.authToken.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
<script src="${PDFJS}/pdf.min.js"></script>
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { margin: 0; height: 100%; background: #1a2a38; font-family: system-ui, sans-serif; overflow: hidden; }
  #scrollWrap {
    position: absolute; top: 0; left: 0; right: 0; bottom: 72px;
    overflow: auto; -webkit-overflow-scrolling: touch;
    scroll-snap-type: y mandatory;
  }
  .pageSlot {
    min-height: 100%; scroll-snap-align: start;
    display: flex; align-items: center; justify-content: center;
    padding: 16px 12px;
  }
  .pageInner {
    transform-origin: center center;
    touch-action: none;
    max-width: 100%;
  }
  canvas {
    display: block; max-width: 100%; height: auto !important;
    border-radius: 4px; box-shadow: 0 8px 24px rgba(0,0,0,.35); background: #fff;
  }
  .bar {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 10;
    background: #F8F7F4; border-top: 1px solid #E5E7EB;
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
    display: flex; align-items: center; gap: 8px;
  }
  button {
    background: #2E4A62; color: #fff; border: none; border-radius: 10px;
    padding: 10px 14px; font-size: 15px; font-weight: 600; flex-shrink: 0;
  }
  button:disabled { opacity: 0.45; }
  #pageInput {
    width: 56px; text-align: center; border: 1px solid #E5E7EB; border-radius: 8px;
    padding: 8px 4px; font-size: 14px; font-weight: 600; color: #2E4A62; background: #fff;
  }
  #pageTotal { color: #6B7280; font-size: 13px; white-space: nowrap; }
  #status {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
    color: #fff; font-size: 14px; text-align: center; padding: 12px; z-index: 5;
  }
</style>
</head>
<body>
<div id="status">Opening book…</div>
<div id="scrollWrap"></div>
<div class="bar">
  <button id="prev" disabled aria-label="Previous page">‹</button>
  <input id="pageInput" type="number" inputmode="numeric" min="1" value="${startPage}" />
  <span id="pageTotal">/ —</span>
  <button id="goPage" type="button">Go</button>
  <button id="next" disabled aria-label="Next page">›</button>
</div>
<script>
  pdfjsLib.GlobalWorkerOptions.workerSrc = "${PDFJS}/pdf.worker.min.js";

  var pdfUrl = '${pdfUrl}';
  var authToken = '${token}';
  var startPage = ${startPage};
  var pdfDoc = null;
  var totalPages = 0;
  var pageNum = startPage;
  var rendered = {};
  var zoom = 1;
  var pinchStartDist = 0;
  var pinchStartZoom = 1;

  function post(type, extra) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, extra || {})));
    }
  }

  function fitScale(viewport) {
    var maxW = window.innerWidth - 24;
    var maxH = window.innerHeight - 120;
    var s = Math.min(maxW / viewport.width, maxH / viewport.height, 2.2);
    return Math.max(s, 0.5);
  }

  function updateBar() {
    document.getElementById('prev').disabled = pageNum <= 1;
    document.getElementById('next').disabled = pageNum >= totalPages;
    document.getElementById('pageInput').value = String(pageNum);
    document.getElementById('pageInput').max = String(totalPages);
    document.getElementById('pageTotal').textContent = '/ ' + totalPages;
  }

  function applyZoom(inner) {
    inner.style.transform = 'scale(' + zoom + ')';
  }

  function attachPinch(inner) {
    inner.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        pinchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        pinchStartZoom = zoom;
      }
    }, { passive: true });
    inner.addEventListener('touchmove', function (e) {
      if (e.touches.length === 2 && pinchStartDist > 0) {
        var dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        zoom = Math.min(4, Math.max(0.6, pinchStartZoom * (dist / pinchStartDist)));
        applyZoom(inner);
        e.preventDefault();
      }
    }, { passive: false });
    inner.addEventListener('touchend', function () { pinchStartDist = 0; });
  }

  async function renderIntoSlot(num, slot) {
    if (rendered[num]) return;
    rendered[num] = true;
    var page = await pdfDoc.getPage(num);
    var baseScale = fitScale(page.getViewport({ scale: 1 }));
    var viewport = page.getViewport({ scale: baseScale });
    var canvas = document.createElement('canvas');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    var inner = document.createElement('div');
    inner.className = 'pageInner';
    inner.appendChild(canvas);
    slot.innerHTML = '';
    slot.appendChild(inner);
    attachPinch(inner);
    applyZoom(inner);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
  }

  function buildSlots() {
    var wrap = document.getElementById('scrollWrap');
    wrap.innerHTML = '';
    for (var i = 1; i <= totalPages; i++) {
      var slot = document.createElement('div');
      slot.className = 'pageSlot';
      slot.dataset.page = String(i);
      slot.innerHTML = '<div style="color:#9CA3AF;font-size:13px">Page ' + i + '</div>';
      wrap.appendChild(slot);
    }
  }

  function scrollToPage(num, smooth) {
    pageNum = Math.min(Math.max(num, 1), totalPages);
    updateBar();
    post('page', { page: pageNum, total: totalPages });
    var slot = document.querySelector('.pageSlot[data-page="' + pageNum + '"]');
    if (slot) {
      slot.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
      renderIntoSlot(pageNum, slot);
    }
    var neighbors = [pageNum - 1, pageNum + 1].filter(function (n) { return n >= 1 && n <= totalPages; });
    neighbors.forEach(function (n) {
      var s = document.querySelector('.pageSlot[data-page="' + n + '"]');
      if (s) renderIntoSlot(n, s);
    });
  }

  var scrollTimer = null;
  document.getElementById('scrollWrap').addEventListener('scroll', function () {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () {
      var wrap = document.getElementById('scrollWrap');
      var mid = wrap.scrollTop + wrap.clientHeight / 2;
      var slots = document.querySelectorAll('.pageSlot');
      for (var i = 0; i < slots.length; i++) {
        var s = slots[i];
        if (s.offsetTop <= mid && s.offsetTop + s.offsetHeight > mid) {
          var n = Number(s.dataset.page);
          if (n !== pageNum) {
            pageNum = n;
            updateBar();
            post('page', { page: pageNum, total: totalPages });
            renderIntoSlot(n, s);
          }
          break;
        }
      }
    }, 120);
  }, { passive: true });

  document.getElementById('prev').onclick = function () { scrollToPage(pageNum - 1, true); };
  document.getElementById('next').onclick = function () { scrollToPage(pageNum + 1, true); };
  document.getElementById('goPage').onclick = function () {
    var v = Number(document.getElementById('pageInput').value);
    if (v >= 1 && v <= totalPages) scrollToPage(v, true);
  };

  window.addEventListener('orientationchange', function () {
    rendered = {};
    setTimeout(function () { scrollToPage(pageNum, false); }, 200);
  });
  window.addEventListener('resize', function () {
    rendered = {};
    setTimeout(function () { scrollToPage(pageNum, false); }, 150);
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
      updateBar();
      post('ready', { total: totalPages, page: Math.min(startPage, totalPages) });
      scrollToPage(Math.min(startPage, totalPages), false);
    })
    .catch(function (err) {
      document.getElementById('status').textContent = 'Could not open PDF.';
      post('error', { message: String(err && err.message ? err.message : err) });
    });
</script>
</body>
</html>`;
}
