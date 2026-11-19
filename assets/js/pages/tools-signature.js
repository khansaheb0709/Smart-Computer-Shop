/* সেবাঘর — signature pad (pointer events; pressure-ish width via velocity) */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
  var pad = document.getElementById('pad'), ctx = pad.getContext('2d');
  var drawing = false, last = null, lastT = 0, mode = 'ink';
  function clearPad() {
    if (mode === 'pad') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, pad.width, pad.height); ctx.strokeStyle = '#c9a227'; ctx.setLineDash([10, 8]); ctx.lineWidth = 4; ctx.strokeRect(12, 12, pad.width - 24, pad.height - 24); ctx.setLineDash([]); }
    else { ctx.clearRect(0, 0, pad.width, pad.height); }
  }
  function pos(e) {
    var r = pad.getBoundingClientRect();
    return { x: (e.clientX - r.left) * pad.width / r.width, y: (e.clientY - r.top) * pad.height / r.height };
  }
  pad.addEventListener('pointerdown', function (e) { drawing = true; last = pos(e); lastT = e.timeStamp; pad.setPointerCapture(e.pointerId); });
  pad.addEventListener('pointermove', function (e) {
    if (!drawing) return;
    var p = pos(e), color = document.getElementById('penColor').value, base = +document.getElementById('penSize').value;
    var dt = Math.max(1, e.timeStamp - lastT), dist = Math.hypot(p.x - last.x, p.y - last.y);
    var w = Math.max(1.2, Math.min(base * 2.4, base * (1 + dist / (dt * 1.4)) ));
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last = p; lastT = e.timeStamp;
  });
  pad.addEventListener('pointerup', function () { drawing = false; });
  pad.addEventListener('pointercancel', function () { drawing = false; });
  document.getElementById('clearBtn').addEventListener('click', clearPad);
  document.getElementById('sigMode').addEventListener('change', function (e) { mode = e.target.value; clearPad(); });
  function exportBlob(cb) {
    if (mode === 'ink') { pad.toBlob(cb, 'image/png'); return; }
    pad.toBlob(cb, 'image/png'); // pad already has white bg + border
  }
  document.getElementById('pngBtn').addEventListener('click', function () {
    exportBlob(function (blob) {
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'signature.png'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    });
  });
  document.getElementById('printBtn').addEventListener('click', function () {
    var mount = document.getElementById('printMount'); mount.innerHTML = ''; mount.style.display = 'block';
    var img = new window.Image(); img.onload = function () { window.print(); setTimeout(function () { mount.style.display = 'none'; }, 600); };
    img.src = pad.toDataURL('image/png'); mount.appendChild(img);
  });
  clearPad();
});
