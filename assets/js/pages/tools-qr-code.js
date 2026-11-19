/* সেবাঘর — QR generator (self-hosted qrcode-generator) */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
  var $ = function (s) { return document.querySelector(s); };
  var canvas = $('#qrCanvas'), ctx = canvas.getContext('2d');
  var lastSvg = '';

  var templates = { url: 'https://', tel: 'tel:', wa: 'https://wa.me/8801', upi: 'upi://pay?pa=your@bank&pn=Smart%20Shop&cu=BDT', sms: 'sms:' };
  document.querySelectorAll('[data-template]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var t = $('#qrText');
      if (!t.value.trim()) t.value = templates[btn.dataset.template];
      else if (btn.dataset.template !== 'upi') t.value = templates[btn.dataset.template];
      t.focus();
    });
  });

  function buildMatrix(text, ecl) {
    var qr = qrcode(0, ecl);      // 0 = auto type number
    qr.addData(text);
    qr.make();
    var n = qr.getModuleCount(), m = [];
    for (var r = 0; r < n; r++) { var row = []; for (var c = 0; c < n; c++) row.push(qr.isDark(r, c)); m.push(row); }
    return m;
  }

  function render(silent) {
    var text = $('#qrText').value.trim();
    if (!text) { if (!silent) alert('কিছু লিখুন বা পেস্ট করুন।'); return; }
    var ecl = $('#eclSel').value, size = Math.max(128, Math.min(4096, +$('#pxSize').value || 1024));
    var fg = $('#fgColor').value, bg = $('#bgColor').value;
    var matrix = buildMatrix(text, ecl), n = matrix.length;
    var margin = 4, cell = Math.floor(size / (n + margin * 2));
    var total = cell * (n + margin * 2);
    canvas.width = total; canvas.height = total;
    ctx.fillStyle = bg; ctx.fillRect(0, 0, total, total);
    ctx.fillStyle = fg;
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++)
      if (matrix[r][c]) ctx.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell);
    // SVG
    var parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (n + margin * 2) + ' ' + (n + margin * 2) + '" shape-rendering="crispEdges">',
      '<rect width="100%" height="100%" fill="' + bg + '"/>'];
    for (var r2 = 0; r2 < n; r2++) for (var c2 = 0; c2 < n; c2++)
      if (matrix[r2][c2]) parts.push('<rect x="' + (c2 + margin) + '" y="' + (r2 + margin) + '" width="1" height="1" fill="' + fg + '"/>');
    parts.push('</svg>');
    lastSvg = parts.join('');
  }
  $('#renderBtn').addEventListener('click', render);
  ['qrText', 'eclSel', 'fgColor', 'bgColor', 'pxSize'].forEach(function (id) {
    $('#' + id).addEventListener('change', function () { render(); });
  });
  $('#pngBtn').addEventListener('click', function () {
    if (!canvas.width) render();
    if (!canvas.width) return;
    var a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = 'shebaghor-qr.png'; a.click();
  });
  $('#svgBtn').addEventListener('click', function () {
    if (!lastSvg) render();
    if (!lastSvg) return;
    var blob = new Blob([lastSvg], { type: 'image/svg+xml;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'shebaghor-qr.svg'; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  });
  $('#printBtn').addEventListener('click', function () {
    if (!canvas.width) render();
    if (!canvas.width) return;
    var mount = $('#printMount'); mount.innerHTML = ''; mount.style.display = 'block';
    var img = new window.Image();
    img.onload = function () { window.print(); setTimeout(function () { mount.style.display = 'none'; }, 600); };
    img.src = canvas.toDataURL('image/png');
    mount.appendChild(img);
  });
  render(true);
});
