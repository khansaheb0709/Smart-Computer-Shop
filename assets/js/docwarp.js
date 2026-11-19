/* সেবাঘর — shared document warp math (homography + bilinear sampling).
   Exposed as window.DocWarp. Pure client-side. */
'use strict';
(function () {
  function solveHomography(src, dst) {
    var A = [], b = [];
    for (var i = 0; i < 4; i++) {
      var sx = src[i].x, sy = src[i].y, dx = dst[i].x, dy = dst[i].y;
      A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]); b.push(dx);
      A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]); b.push(dy);
    }
    var n = 8, M = A.map(function (row, i) { return row.concat([b[i]]); });
    for (var col = 0; col < n; col++) {
      var piv = col;
      for (var r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
      var tmp = M[col]; M[col] = M[piv]; M[piv] = tmp;
      var pv = M[col][col]; if (Math.abs(pv) < 1e-10) continue;
      for (var r = 0; r < n; r++) { if (r === col) continue; var f = M[r][col] / pv; for (var c = 0; c <= n; c++) M[r][c] -= f * M[col][c]; }
    }
    var h = [];
    for (var i = 0; i < n; i++) h.push(M[i][n] / (Math.abs(M[i][i]) < 1e-10 ? 1e-10 : M[i][i]));
    return h;
  }
  function mapPoint(h, x, y) {
    var d = h[6] * x + h[7] * y + 1;
    return { x: (h[0] * x + h[1] * y + h[2]) / d, y: (h[3] * x + h[4] * y + h[5]) / d };
  }
  function sampleBilinear(data, W, H, x, y) {
    if (x < 0 || y < 0 || x > W - 1 || y > H - 1) return [255, 255, 255];
    var x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    var x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1);
    function px(xx, yy) { var i = (yy * W + xx) * 4; return [data[i], data[i + 1], data[i + 2]]; }
    var p00 = px(x0, y0), p10 = px(x1, y0), p01 = px(x0, y1), p11 = px(x1, y1);
    var out = [0, 0, 0];
    for (var c = 0; c < 3; c++) out[c] = p00[c] * (1 - fx) * (1 - fy) + p10[c] * fx * (1 - fy) + p01[c] * (1 - fx) * fy + p11[c] * fx * fy;
    return out;
  }
  function warpToCanvas(srcCanvas, corners, DW, DH) {
    var sctx = srcCanvas.getContext('2d');
    var src = sctx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
    var dst = [{ x: 0, y: 0 }, { x: DW, y: 0 }, { x: DW, y: DH }, { x: 0, y: DH }];
    var hInv = solveHomography(dst, corners);
    var out = document.createElement('canvas'); out.width = DW; out.height = DH;
    var octx = out.getContext('2d');
    var img = octx.createImageData(DW, DH), d = img.data;
    for (var y = 0; y < DH; y++) for (var x = 0; x < DW; x++) {
      var sp = mapPoint(hInv, x, y);
      var rgb = sampleBilinear(src.data, srcCanvas.width, srcCanvas.height, sp.x, sp.y);
      var i = (y * DW + x) * 4;
      d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
    }
    octx.putImageData(img, 0, 0);
    return out;
  }
  window.DocWarp = { solveHomography: solveHomography, mapPoint: mapPoint, sampleBilinear: sampleBilinear, warpToCanvas: warpToCanvas };
})();
