/* সেবাঘর — passport photo studio (fully client-side; no uploads) */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
  var $ = function (s) { return document.querySelector(s); };
  var srcCanvas = null;              // rotated working copy (natural pixels)
  var aspect = { w: 35, h: 45, id: '35x45' };
  var crop = null;                   // {x,y,w,h} in working pixels
  var tolerance = 46, targetBg = 'keep', sampledBg = null;
  var bri = 100, con = 100, sat = 100;
  var layout = '4x5', cutLines = true, eyeDropMode = false;
  var preview = $('#previewCanvas'), pctx = preview.getContext('2d');
  var sheet = $('#sheetCanvas'), sctx = sheet.getContext('2d');
  var DPR = 1;

  /* ---------- file / camera ---------- */
  var stream = null;
  function loadImageFile(file) {
    var img = new Image();
    img.onload = function () { initFromImage(img); URL.revokeObjectURL(img.src); };
    img.src = URL.createObjectURL(file);
  }
  $('#fileInput').addEventListener('change', function (e) { var f = e.target.files[0]; if (f) loadImageFile(f); });
  $('#cameraBtn').addEventListener('click', async function () {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 } }, audio: false });
      var v = $('#camVideo'); v.srcObject = stream; v.style.display = 'block'; await v.play();
      $('#camRow').style.display = 'flex';
    } catch (err) { alert('ক্যামেরা খোলা যায়নি — HTTPS আবশ্যক ও অনুমতি দিন।'); }
  });
  $('#camStopBtn').addEventListener('click', stopCam);
  $('#camSnapBtn').addEventListener('click', function () {
    var v = $('#camVideo'); if (!v.videoWidth) return;
    var c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    var img = new Image(); img.onload = function () { initFromImage(img); }; img.src = c.toDataURL('image/jpeg', 0.92);
    stopCam();
  });
  function stopCam() { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } $('#camVideo').style.display = 'none'; $('#camRow').style.display = 'none'; }

  /* ---------- init / rotate ---------- */
  function initFromImage(img) {
    srcCanvas = document.createElement('canvas');
    srcCanvas.width = img.naturalWidth; srcCanvas.height = img.naturalHeight;
    srcCanvas.getContext('2d').drawImage(img, 0, 0);
    $('#editPanel').hidden = false; $('#exportPanel').hidden = false;
    resetCrop();
    renderSheet();
  }
  function rotate90() {
    if (!srcCanvas) return;
    var c = document.createElement('canvas'); c.width = srcCanvas.height; c.height = srcCanvas.width;
    var ctx = c.getContext('2d');
    ctx.translate(c.width / 2, c.height / 2); ctx.rotate(Math.PI / 2);
    ctx.drawImage(srcCanvas, -srcCanvas.width / 2, -srcCanvas.height / 2);
    srcCanvas = c; resetCrop(); renderSheet();
  }
  $('#rotateBtn').addEventListener('click', rotate90);
  $('#centerBtn').addEventListener('click', function () { centerCrop(); drawPreview(); renderSheet(); });

  function aspectRatio() { return aspect.w / aspect.h; }
  function resetCrop() {
    if (!srcCanvas) return;
    var r = aspectRatio(), W = srcCanvas.width, H = srcCanvas.height;
    var h = Math.min(H, W / r) * 0.72, w = h * r;
    crop = { x: (W - w) / 2, y: (H - h) / 2, w: w, h: h };
    drawPreview();
  }
  function centerCrop() { if (!crop) return; crop.x = (srcCanvas.width - crop.w) / 2; crop.y = (srcCanvas.height - crop.h) / 2; }

  /* ---------- preview drawing ---------- */
  function drawPreview() {
    if (!srcCanvas || !crop) return;
    var W = preview.width = 480, H = preview.height = 480;
    var s = Math.min(W / srcCanvas.width, H / srcCanvas.height);
    var ox = (W - srcCanvas.width * s) / 2, oy = (H - srcCanvas.height * s) / 2;
    pctx.clearRect(0, 0, W, H);
    pctx.fillStyle = '#111'; pctx.fillRect(0, 0, W, H);
    pctx.drawImage(srcCanvas, ox, oy, srcCanvas.width * s, srcCanvas.height * s);
    // dim outside crop
    var cx = ox + crop.x * s, cy = oy + crop.y * s, cw = crop.w * s, ch = crop.h * s;
    pctx.fillStyle = 'rgba(5,10,8,.45)';
    pctx.fillRect(0, 0, W, cy); pctx.fillRect(0, cy + ch, W, H - cy - ch);
    pctx.fillRect(0, cy, cx, ch); pctx.fillRect(cx + cw, cy, W - cx - cw, ch);
    pctx.strokeStyle = '#c9a227'; pctx.lineWidth = 3; pctx.setLineDash([8, 5]);
    pctx.strokeRect(cx, cy, cw, ch); pctx.setLineDash([]);
    // corner ticks
    pctx.fillStyle = '#f5e6b0';
    [[cx, cy], [cx + cw, cy], [cx, cy + ch], [cx + cw, ch + cy]].forEach(function (p) { pctx.fillRect(p[0] - 4, p[1] - 4, 8, 8); });
  }

  /* drag to move crop */
  var dragging = false, last = null;
  function evPos(e) {
    var r = preview.getBoundingClientRect();
    var cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    var cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
    return { x: cx * (preview.width / r.width), y: cy * (preview.height / r.height) };
  }
  function canvasToImage(p) {
    var W = preview.width, H = preview.height;
    var s = Math.min(W / srcCanvas.width, H / srcCanvas.height);
    var ox = (W - srcCanvas.width * s) / 2, oy = (H - srcCanvas.height * s) / 2;
    return { x: (p.x - ox) / s, y: (p.y - oy) / s };
  }
  preview.addEventListener('pointerdown', function (e) {
    if (!crop) return;
    var p = canvasToImage(evPos(e));
    if (eyeDropMode) { pickBg(p); eyeDropMode = false; $('#eyedropBtn').blur(); return; }
    dragging = true; last = p; preview.setPointerCapture(e.pointerId);
  });
  preview.addEventListener('pointermove', function (e) {
    if (!dragging || !crop) return;
    var p = canvasToImage(evPos(e));
    crop.x += p.x - last.x; crop.y += p.y - last.y;
    crop.x = Math.max(0, Math.min(srcCanvas.width - crop.w, crop.x));
    crop.y = Math.max(0, Math.min(srcCanvas.height - crop.h, crop.y));
    last = p; drawPreview(); renderSheetDebounced();
  });
  preview.addEventListener('pointerup', function () { dragging = false; });

  function pickBg(p) {
    var ctx = srcCanvas.getContext('2d');
    var m = Math.min(24, Math.floor(srcCanvas.width / 10));
    var x = Math.max(0, Math.min(srcCanvas.width - m, Math.floor(p.x) - m / 2 | 0));
    var y = Math.max(0, Math.min(srcCanvas.height - m, Math.floor(p.y) - m / 2 | 0));
    var d = ctx.getImageData(x, y, m, m).data, r = 0, g = 0, b = 0, n = d.length / 4;
    for (var i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    sampledBg = { r: r / n | 0, g: g / n | 0, b: b / n | 0 };
    renderSheet();
  }

  /* ---------- controls ---------- */
  document.querySelectorAll('#aspectRow [data-aspect]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var map = { '35x45': [35, 45], '2x2': [2, 2], '1x1': [1, 1], '4x5cm': [4, 5] };
      aspect = { w: map[btn.dataset.aspect][0], h: map[btn.dataset.aspect][1], id: btn.dataset.aspect };
      resetCrop(); renderSheet();
    });
  });
  $('#zoomRange').addEventListener('input', function (e) {
    if (!srcCanvas || !crop) return;
    var v = +e.target.value / 100;
    var maxH = Math.min(srcCanvas.height, srcCanvas.width / aspectRatio());
    var newH = Math.max(maxH * 0.25, maxH * v);
    var cx = crop.x + crop.w / 2, cy = crop.y + crop.h / 2;
    crop.h = newH; crop.w = newH * aspectRatio();
    crop.x = Math.max(0, Math.min(srcCanvas.width - crop.w, cx - crop.w / 2));
    crop.y = Math.max(0, Math.min(srcCanvas.height - crop.h, cy - crop.h / 2));
    drawPreview(); renderSheetDebounced();
  });
  [['briRange', function (v) { bri = v; }], ['conRange', function (v) { con = v; }], ['satRange', function (v) { sat = v; }]].forEach(function (pair) {
    $('#' + pair[0]).addEventListener('input', function (e) { pair[1](+e.target.value); renderSheetDebounced(); });
  });
  $('#tolRange').addEventListener('input', function (e) { tolerance = +e.target.value; renderSheetDebounced(); });
  document.querySelectorAll('.bg-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { targetBg = btn.dataset.bg; renderSheet(); });
  });
  $('#eyedropBtn').addEventListener('click', function () { eyeDropMode = true; });
  document.querySelectorAll('.layout-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { layout = btn.dataset.layout; renderSheet(); });
  });
  $('#cutLines').addEventListener('change', function (e) { cutLines = e.target.checked; renderSheet(); });

  /* ---------- core render pipeline ---------- */
  var debounce = null;
  function renderSheetDebounced() { clearTimeout(debounce); debounce = setTimeout(renderSheet, 60); }

  function cornerBgColor() {
    // median of four corner 10px patches
    var ctx = srcCanvas.getContext('2d'), W = srcCanvas.width, H = srcCanvas.height, p = Math.max(6, Math.floor(Math.min(W, H) * 0.06));
    var pts = [[0, 0], [W - p, 0], [0, H - p], [W - p, H - p]], rs = 0, gs = 0, bs = 0, n = 0;
    pts.forEach(function (pt) {
      var d = ctx.getImageData(pt[0], pt[1], p, p).data;
      for (var i = 0; i < d.length; i += 4) { rs += d[i]; gs += d[i + 1]; bs += d[i + 2]; n++; }
    });
    return { r: rs / n | 0, g: gs / n | 0, b: bs / n | 0 };
  }
  function hexToRgb(h) { h = h.replace('#', ''); return { r: parseInt(h.substr(0, 2), 16), g: parseInt(h.substr(2, 2), 16), b: parseInt(h.substr(4, 2), 16) }; }

  function renderProcessedPhoto(sizePx) {
    // returns canvas with filter+bg-replaced crop at requested square/rect pixel size
    var c = document.createElement('canvas');
    var rw = Math.round(sizePx * (crop.w / crop.w)), rh = Math.round(sizePx * (crop.h / crop.w));
    // keep native crop aspect; caller sets scale
    c.width = Math.max(2, Math.round(crop.w)); c.height = Math.max(2, Math.round(crop.h));
    var ctx = c.getContext('2d');
    ctx.filter = 'brightness(' + bri + '%) contrast(' + con + '%) saturate(' + sat + '%)';
    ctx.drawImage(srcCanvas, crop.x, crop.y, crop.w, crop.h, 0, 0, c.width, c.height);
    ctx.filter = 'none';
    if (targetBg !== 'keep') {
      var sample = sampledBg || cornerBgColor();
      var tgt = hexToRgb(targetBg);
      var img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
      var tol2 = tolerance * tolerance * 3;
      for (var i = 0; i < d.length; i += 4) {
        var dr = d[i] - sample.r, dg = d[i + 1] - sample.g, db = d[i + 2] - sample.b;
        var dist2 = dr * dr + dg * dg + db * db;
        if (dist2 < tol2) {
          var f = 1 - dist2 / tol2;            // 1 = definitely bg
          if (f > 0.75) { d[i] = tgt.r; d[i + 1] = tgt.g; d[i + 2] = tgt.b; }
          else { var m = (f - 0.75) / 0.25; d[i] = d[i] * (1 - m) + tgt.r * m; d[i + 1] = d[i + 1] * (1 - m) + tgt.g * m; d[i + 2] = d[i + 2] * (1 - m) + tgt.b * m; }
        }
      }
      ctx.putImageData(img, 0, 0);
    }
    return c;
  }

  var layouts = { '4x5': [4, 5], '3x4': [3, 4], '2x4': [2, 4], '1': [1, 1] };
  function renderSheet() {
    if (!srcCanvas || !crop) return;
    // single export canvas, ~150 dpi A4
    var A4W = 1240, A4H = 1754;
    sheet.width = A4W; sheet.height = A4H;
    sctx.fillStyle = '#ffffff'; sctx.fillRect(0, 0, A4W, A4H);
    var cols = layouts[layout][0], rows = layouts[layout][1];
    var margin = 34, gap = 16;
    var cellW = (A4W - margin * 2 - gap * (cols - 1)) / cols;
    var cellH = cellW * (crop.h / crop.w);
    var totalH = rows * cellH + (rows - 1) * gap;
    var oy = Math.max(margin, (A4H - totalH) / 2);
    var photo = renderProcessedPhoto();
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var x = margin + c * (cellW + gap), y = oy + r * (cellH + gap);
      sctx.drawImage(photo, x, y, cellW, cellH);
      if (cutLines) {
        sctx.strokeStyle = '#c7c3b4'; sctx.lineWidth = 1.2; sctx.setLineDash([6, 4]);
        sctx.strokeRect(x, y, cellW, cellH); sctx.setLineDash([]);
      }
    }
  }

  /* ---------- export / print ---------- */
  function renderSingleExport() {
    var photo = renderProcessedPhoto();
    var out = document.createElement('canvas');
    var ratio = crop.h / crop.w;
    out.width = 413; out.height = Math.round(413 * ratio);
    out.getContext('2d').drawImage(photo, 0, 0, out.width, out.height);
    return out;
  }
  $('#downloadSheetBtn').addEventListener('click', function () {
    var a = document.createElement('a'); a.href = sheet.toDataURL('image/png'); a.download = 'shebaghor-passport-sheet.png'; a.click();
  });
  $('#downloadSingleBtn').addEventListener('click', function () {
    var out = renderSingleExport();
    var a = document.createElement('a'); a.href = out.toDataURL('image/png'); a.download = 'passport-photo.png'; a.click();
  });
  $('#printBtn').addEventListener('click', function () {
    var mount = $('#printMount'); mount.innerHTML = ''; mount.style.display = 'block';
    var img = new window.Image();
    img.onload = function () { window.print(); setTimeout(function () { mount.style.display = 'none'; }, 600); };
    img.src = sheet.toDataURL('image/jpeg', 0.93);
    mount.appendChild(img);
  });
  drawPreview();
});
