/* সেবাঘর — ID card composer: front+back → CR80 print sheet */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
  var $ = function (s) { return document.querySelector(s); };
  // CR80 @ ~300dpi ≈ 1011×638 px; we use 1012×638 (aspect 1.586)
  var CW = 1012, CH = 638, A4W = 1240, A4H = 1754;
  var cut = true, layout = 'front-back';
  var sides = {
    front: { canvas: $('#frontCanvas'), stage: $('#frontStage'), hint: $('#frontHint'), handles: null, corners: null, imgData: null },
    back:  { canvas: $('#backCanvas'),  stage: $('#backStage'),  hint: $('#backHint'),  handles: null, corners: null, imgData: null }
  };
  var sheet = $('#sheetCanvas'), sctx = sheet.getContext('2d');

  function loadSide(name, file) {
    var side = sides[name];
    var img = new Image();
    img.onload = function () {
      var maxDim = 1400, s = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      side.canvas.width = Math.round(img.naturalWidth * s); side.canvas.height = Math.round(img.naturalHeight * s);
      side.canvas.getContext('2d').drawImage(img, 0, 0, side.canvas.width, side.canvas.height);
      URL.revokeObjectURL(img.src);
      side.stage.hidden = false; side.hint.hidden = false;
      var W = side.canvas.width, H = side.canvas.height, m = 0.06 * Math.min(W, H);
      side.corners = [{ x: m, y: m }, { x: W - m, y: m }, { x: W - m, y: H - m }, { x: m, y: H - m }];
      side.handles = Array.prototype.slice.call(side.stage.querySelectorAll('.corner-handle'));
      bindHandles(side);
      placeHandles(side);
      $('#outPanel').hidden = false;
      renderSheet();
    };
    img.src = URL.createObjectURL(file);
  }
  $('#frontInput').addEventListener('change', function (e) { var f = e.target.files[0]; if (f) loadSide('front', f); });
  $('#backInput').addEventListener('change', function (e) { var f = e.target.files[0]; if (f) loadSide('back', f); });

  function placeHandles(side) {
    side.handles.forEach(function (h, i) {
      h.style.left = (side.corners[i].x / side.canvas.width * 100) + '%';
      h.style.top = (side.corners[i].y / side.canvas.height * 100) + '%';
    });
  }
  function toSrc(side, e) {
    var r = side.canvas.getBoundingClientRect();
    var cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    var cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
    return { x: Math.max(0, Math.min(side.canvas.width, cx * side.canvas.width / r.width)),
             y: Math.max(0, Math.min(side.canvas.height, cy * side.canvas.height / r.height)) };
  }
  var drag = null;
  function bindHandles(side) {
    side.handles.forEach(function (h) {
      h.addEventListener('pointerdown', function (e) { drag = { side: side, idx: +h.dataset.i }; h.setPointerCapture(e.pointerId); e.preventDefault(); });
      h.addEventListener('pointermove', function (e) {
        if (!drag || drag.side !== side) return;
        side.corners[drag.idx] = toSrc(side, e); placeHandles(side); renderSheetDebounced();
      });
      h.addEventListener('pointerup', function () { drag = null; });
    });
  }

  function sideImage(name) {
    var side = sides[name];
    if (!side.corners) return null;
    return DocWarp.warpToCanvas(side.canvas, side.corners, CW, CH);
  }

  var debounce = null;
  function renderSheetDebounced() { clearTimeout(debounce); debounce = setTimeout(renderSheet, 160); }
  function renderSheet() {
    var front = sideImage('front'), back = sideImage('back');
    if (!front && !back) return;
    sheet.width = A4W; sheet.height = A4H;
    sctx.fillStyle = '#ffffff'; sctx.fillRect(0, 0, A4W, A4H);
    var W = 1012, H = 638, margin = 70, gap = 46;
    function cell(img, x, y, label) {
      if (!img) return;
      sctx.save();
      if (cut) { sctx.fillStyle = '#d8d5c9'; sctx.fillRect(x - 3, y - 3, W + 6, H + 6); }
      sctx.drawImage(img, x, y, W, H);
      sctx.restore();
    }
    var x = (A4W - W) / 2;
    if (layout === 'front-back') {
      var y = (A4H - (2 * H + gap)) / 2;
      cell(front || back, x, y); cell(back || front, x, y + H + gap);
    } else if (layout === 'front-2') {
      var y2 = (A4H - (2 * H + gap)) / 2;
      cell(front, x, y2); cell(front, x, y2 + H + gap);
    } else { // grid x4
      var gw = A4W - margin * 2 - 30;
      var cw = Math.min(W, gw / 2), ch = cw * (CH / CW);
      var xs = [margin, margin + cw + 30], ys = [Math.max(margin, (A4H - 2 * ch - 30) / 2), Math.max(margin, (A4H - 2 * ch - 30) / 2) + ch + 30];
      var list = [front, back || front, back || front, front];
      for (var r = 0; r < 2; r++) for (var c = 0; c < 2; c++) {
        var img = list[r * 2 + c]; if (img) cell(img, xs[c], ys[r]);
      }
    }
  }
  document.querySelectorAll('.layout-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { layout = btn.dataset.layout; renderSheet(); });
  });
  $('#cutLines').addEventListener('change', function (e) { cut = e.target.checked; renderSheet(); });
  $('#printBtn').addEventListener('click', function () {
    var mount = $('#printMount'); mount.innerHTML = ''; mount.style.display = 'block';
    var img = new window.Image();
    img.onload = function () { window.print(); setTimeout(function () { mount.style.display = 'none'; mount.innerHTML = ''; }, 700); };
    img.src = sheet.toDataURL('image/jpeg', 0.93);
    mount.appendChild(img);
  });
  $('#pngBtn').addEventListener('click', function () {
    var a = document.createElement('a'); a.href = sheet.toDataURL('image/png'); a.download = 'shebaghor-id-card.png'; a.click();
  });
});
