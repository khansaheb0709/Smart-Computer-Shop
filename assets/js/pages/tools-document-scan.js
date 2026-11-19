/* সেবাঘর — document scanner: perspective correct + flat-field shadow removal.
   Fully client-side. No uploads. */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
  var $ = function (s) { return document.querySelector(s); };
  var srcCanvas = $('#srcCanvas'), stage = $('#stage'), outCanvas = $('#outCanvas');
  var handles = Array.prototype.slice.call(stage.querySelectorAll('.corner-handle'));
  var corners = null;                 // [tl,tr,br,bl] in srcCanvas pixels
  var mode = 'color';
  var bright = 1.12, bwThresh = 140;
  var DEBOUNCE = null;

  /* ============ load ============ */
  $('#fileInput').addEventListener('change', function (e) {
    var f = e.target.files[0]; if (!f) return;
    var img = new Image();
    img.onload = function () {
      var maxDim = 1800, s = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      srcCanvas.width = Math.round(img.naturalWidth * s); srcCanvas.height = Math.round(img.naturalHeight * s);
      srcCanvas.getContext('2d').drawImage(img, 0, 0, srcCanvas.width, srcCanvas.height);
      URL.revokeObjectURL(img.src);
      stage.hidden = false; $('#outPanel').hidden = false;
      defaultCorners(); autoDetect(); renderOut();
    };
    img.src = URL.createObjectURL(f);
  });

  function defaultCorners() {
    var W = srcCanvas.width, H = srcCanvas.height, m = 0.08 * Math.min(W, H);
    corners = [{ x: m, y: m }, { x: W - m, y: m }, { x: W - m, y: H - m }, { x: m, y: H - m }];
    placeHandles();
  }
  function placeHandles() {
    if (!corners) return;
    handles.forEach(function (h, i) {
      h.style.left = (corners[i].x / srcCanvas.width * 100) + '%';
      h.style.top = (corners[i].y / srcCanvas.height * 100) + '%';
    });
  }
  $('#resetBtn').addEventListener('click', function () { defaultCorners(); renderOut(); });

  /* ============ auto-detect (Sobel + extremes) ============ */
  function autoDetect() {
    var W = srcCanvas.width, H = srcCanvas.height;
    var sw = 220, sh = Math.max(1, Math.round(H * sw / W));
    var sc = document.createElement('canvas'); sc.width = sw; sc.height = sh;
    var sctx = sc.getContext('2d');
    sctx.drawImage(srcCanvas, 0, 0, sw, sh);
    var img = sctx.getImageData(0, 0, sw, sh), d = img.data;
    var g = new Float32Array(sw * sh);
    for (var i = 0, p = 0; i < d.length; i += 4, p++) g[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    var mag = new Float32Array(sw * sh), sum = 0, n = 0;
    for (var y = 1; y < sh - 1; y++) for (var x = 1; x < sw - 1; x++) {
      var i0 = y * sw + x;
      var gx = -g[i0 - sw - 1] - 2 * g[i0 - 1] - g[i0 + sw - 1] + g[i0 - sw + 1] + 2 * g[i0 + 1] + g[i0 + sw + 1];
      var gy = -g[i0 - sw - 1] - 2 * g[i0 - sw] - g[i0 - sw + 1] + g[i0 + sw - 1] + 2 * g[i0 + sw] + g[i0 + sw + 1];
      var m = Math.sqrt(gx * gx + gy * gy); mag[i0] = m; sum += m; n++;
    }
    var mean = sum / n, thr = mean * 1.15 + 18;
    var pts = [];
    for (var y = 1; y < sh - 1; y++) for (var x = 1; x < sw - 1; x++) if (mag[y * sw + x] > thr) pts.push({ x: x, y: y });
    if (pts.length < 40) return; // keep default
    var c1 = pts[0], c2 = pts[0], c3 = pts[0], c4 = pts[0]; // tl,tr,br,bl extremes
    pts.forEach(function (p) {
      var s = p.x + p.y, df = p.x - p.y;
      if (s < c1.x + c1.y) c1 = p;
      if (df > c2.x - c2.y) c2 = p;
      if (s > c3.x + c3.y) c3 = p;
      if (df < c4.x - c4.y) c4 = p;
    });
    var k = sw / W;  // scale back to srcCanvas pixels
    function sp(p) { return { x: Math.round(p.x / k), y: Math.round(p.y / k) }; }
    corners = [sp(c1), sp(c2), sp(c3), sp(c4)];
    placeHandles();
  }
  $('#autoBtn').addEventListener('click', function () { autoDetect(); renderOut(); });

  /* ============ handle dragging ============ */
  var dragIdx = -1;
  function toSrc(e) {
    var r = srcCanvas.getBoundingClientRect();
    var cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    var cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
    return { x: Math.max(0, Math.min(srcCanvas.width, cx * srcCanvas.width / r.width)),
             y: Math.max(0, Math.min(srcCanvas.height, cy * srcCanvas.height / r.height)) };
  }
  handles.forEach(function (h) {
    h.addEventListener('pointerdown', function (e) { dragIdx = +h.dataset.i; h.setPointerCapture(e.pointerId); e.preventDefault(); });
    h.addEventListener('pointermove', function (e) {
      if (dragIdx < 0) return;
      corners[dragIdx] = toSrc(e); placeHandles(); renderOutDebounced();
    });
    h.addEventListener('pointerup', function () { dragIdx = -1; });
  });

  /* ============ fast box blur via integral image ============ */
  function boxBlurIntegral(src, W, H, radius) {
    var integ = new Float64Array((W + 1) * (H + 1));
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) integ[(y + 1) * (W + 1) + x + 1] = src[y * W + x] + integ[y * (W + 1) + x + 1] + integ[(y + 1) * (W + 1) + x] - integ[y * (W + 1) + x];
    var dst = new Float32Array(W * H);
    for (var y = 0; y < H; y++) {
      var y0 = Math.max(0, y - radius), y1 = Math.min(H - 1, y + radius);
      for (var x = 0; x < W; x++) {
        var x0 = Math.max(0, x - radius), x1 = Math.min(W - 1, x + radius);
        var sum = integ[(y1 + 1) * (W + 1) + x1 + 1] - integ[y0 * (W + 1) + x1 + 1] - integ[(y1 + 1) * (W + 1) + x0] + integ[y0 * (W + 1) + x0];
        dst[y * W + x] = sum / ((x1 - x0 + 1) * (y1 - y0 + 1));
      }
    }
    return dst;
  }

  function renderOut() {
    if (!corners) return;
    var DW = 1240, DH = 1754;             // A4 @150dpi
    var src = srcCanvas.getContext('2d').getImageData(0, 0, srcCanvas.width, srcCanvas.height);
    var dst = [{ x: 0, y: 0 }, { x: DW, y: 0 }, { x: DW, y: DH }, { x: 0, y: DH }];
    var hDstToSrc = DocWarp.solveHomography(dst, corners);
    var warped = new Uint8ClampedArray(DW * DH * 4);
    for (var y = 0; y < DH; y++) {
      for (var x = 0; x < DW; x++) {
        var sp = DocWarp.mapPoint(hDstToSrc, x, y);
        var rgb = DocWarp.sampleBilinear(src.data, srcCanvas.width, srcCanvas.height, sp.x, sp.y);
        var i = (y * DW + x) * 4;
        warped[i] = rgb[0]; warped[i + 1] = rgb[1]; warped[i + 2] = rgb[2]; warped[i + 3] = 255;
      }
      if ((y & 63) === 0) { /* keep infrequent yield points */ }
    }
    // flat-field: estimate uneven background on 1/6 scale, divide it out
    var SW2 = Math.round(DW / 6), SH2 = Math.round(DH / 6);
    var small = new Float32Array(SW2 * SH2);
    for (var y = 0; y < SH2; y++) for (var x = 0; x < SW2; x++) {
      var acc = [0, 0, 0], cnt = 0;
      for (var yy = 0; yy < 6; yy += 2) for (var xx = 0; xx < 6; xx += 2) {
        var sx = Math.min(DW - 1, x * 6 + xx), sy = Math.min(DH - 1, y * 6 + yy);
        var i = (sy * DW + sx) * 4; acc[0] += warped[i]; acc[1] += warped[i + 1]; acc[2] += warped[i + 2]; cnt++;
      }
      small[y * SW2 + x] = 0.299 * acc[0] / cnt + 0.587 * acc[1] / cnt + 0.114 * acc[2] / cnt;
    }
    var radius = Math.round(SW2 / 6);
    var bg = boxBlurIntegral(small, SW2, SH2, radius);
    // upsamplebg bilinear with clamp gain
    function bgAt(x, y) {
      var fx = x / 6, fy = y / 6;
      var x0 = Math.floor(fx), y0 = Math.floor(fy), dx = fx - x0, dy = fy - y0;
      var x1 = Math.min(SW2 - 1, x0 + 1), y1 = Math.min(SH2 - 1, y0 + 1);
      return bg[y0 * SW2 + x0] * (1 - dx) * (1 - dy) + bg[y0 * SW2 + x1] * dx * (1 - dy) + bg[y1 * SW2 + x0] * (1 - dx) * dy + bg[y1 * SW2 + x1] * dx * dy;
    }
    var gray = new Float32Array(DW * DH);
    for (var i = 0, p = 0; i < warped.length; i += 4, p++) gray[p] = 0.299 * warped[i] + 0.587 * warped[i + 1] + 0.114 * warped[i + 2];
    outCanvas.width = DW; outCanvas.height = DH;
    var octx = outCanvas.getContext('2d');
    var out = octx.createImageData(DW, DH);
    var od = out.data;
    for (var y = 0; y < DH; y++) for (var x = 0; x < DW; x++) {
      var i = (y * DW + x) * 4, p = y * DW + x;
      var bgv = Math.max(30, bgAt(x, y));
      var gain = 245 / bgv;
      var r = warped[i] * gain, g2 = warped[i + 1] * gain, b2 = warped[i + 2] * gain;
      var lum = gray[p] * gain;
      var v;
      if (mode === 'color') { v = [r, g2, b2]; }
      else if (mode === 'gray') { v = [lum, lum, lum]; }
      else { var bw = lum > bwThresh ? 255 : 0; v = [bw, bw, bw]; }
      od[i] = Math.min(255, Math.max(0, v[0] * bright));
      od[i + 1] = Math.min(255, Math.max(0, v[1] * bright));
      od[i + 2] = Math.min(255, Math.max(0, v[2] * bright));
      od[i + 3] = 255;
    }
    octx.putImageData(out, 0, 0);
  }
  var renderTimer = null;
  function renderOutDebounced() { clearTimeout(renderTimer); renderTimer = setTimeout(renderOut, 140); }
  function renderOutDebouncedToggle() { renderOut(); }

  document.querySelectorAll('.mode-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { mode = btn.dataset.mode; renderOut(); });
  });
  $('#brightRange').addEventListener('input', function (e) { bright = +e.target.value / 100; renderOutDebounced(); });
  $('#bwRange').addEventListener('input', function (e) { bwThresh = +e.target.value; renderOutDebounced(); });

  /* ============ export / print ============ */
  function printOut() {
    var mount = $('#printMount'); mount.innerHTML = ''; mount.style.display = 'block';
    var img = new window.Image();
    img.src = outCanvas.toDataURL('image/jpeg', 0.92);
    img.onload = function () { window.print(); setTimeout(function () { mount.style.display = 'none'; mount.innerHTML = ''; }, 700); };
    mount.appendChild(img);
  }
  $('#printBtn').addEventListener('click', printOut);
  $('#pngBtn').addEventListener('click', function () {
    var a = document.createElement('a'); a.href = outCanvas.toDataURL('image/png'); a.download = 'shebaghor-scan.png'; a.click();
  });
  $('#pdfBtn').addEventListener('click', function () {
    try {
      var JsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
      var doc = new JsPDF({ unit: 'pt', format: 'a4' });
      doc.addImage(outCanvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 595.28, 841.89);
      doc.save('shebaghor-scan.pdf');
    } catch (e) { printOut(); }
  });
});
