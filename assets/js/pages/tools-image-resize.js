/* সেবাঘর — image resize with target-KB JPEG compression */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
  var $ = function (s) { return document.querySelector(s); };
  var img = null, origW = 0, origH = 0;
  var preview = $('#previewCanvas'), pctx = preview.getContext('2d');
  var outBlob = null;

  function loadFile(file) {
    var im = new Image();
    im.onload = function () {
      img = im; origW = im.naturalWidth; origH = im.naturalHeight;
      $('#origInfo').textContent = 'মূল: ' + origW + '×' + origH + 'px';
      applyPreset($('#presetSel').value);
    };
    im.src = URL.createObjectURL(file);
  }
  $('#fileInput').addEventListener('change', function (e) { var f = e.target.files[0]; if (f) loadFile(f); });

  function applyPreset(p) {
    if (!img) return;
    var w = origW, h = origH;
    if (p === 'max1600') { var s = Math.min(1, 1600 / Math.max(w, h)); w = Math.round(w * s); h = Math.round(h * s); }
    else if (p !== 'custom') { var parts = p.split('x'); w = +parts[0]; h = +parts[1]; }
    $('#wInput').value = w; $('#hInput').value = h;
    render();
  }
  $('#presetSel').addEventListener('change', function (e) { applyPreset(e.target.value); });
  $('#wInput').addEventListener('input', function () {
    if ($('#keepRatio').checked && img) { var w = +$('#wInput').value || 1; $('#hInput').value = Math.max(1, Math.round(origH * w / origW)); }
    $('#presetSel').value = 'custom'; render();
  });
  $('#hInput').addEventListener('input', function () {
    if ($('#keepRatio').checked && img) { var h = +$('#hInput').value || 1; $('#wInput').value = Math.max(1, Math.round(origW * h / origH)); }
    $('#presetSel').value = 'custom'; render();
  });
  $('#kbInput').addEventListener('input', render);

  function render() {
    if (!img) return;
    var w = Math.max(1, +$('#wInput').value || 1), h = Math.max(1, +$('#hInput').value || 1);
    var scale = Math.min(1, 700 / Math.max(w, h));
    preview.width = Math.max(1, Math.round(w * scale)); preview.height = Math.max(1, Math.round(h * scale));
    pctx.clearRect(0, 0, preview.width, preview.height);
    pctx.drawImage(img, 0, 0, preview.width, preview.height);
    compress(w, h, +$('#kbInput').value || 200);
  }
  function compress(w, h, targetKB) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    var lo = 0.3, hi = 0.95, best = null;
    // binary search JPEG quality to fit target KB
    var attempts = 0;
    function done(blob, q, kb) {
      outBlob = blob;
      $('#outInfo').textContent = 'আউটপুট: ' + w + '×' + h + 'px · ' + kb.toFixed(0) + ' KB (quality ' + q.toFixed(2) + ')';
    }
    function step() {
      attempts++;
      var q = (lo + hi) / 2;
      c.toBlob(function (blob) {
        if (!blob) { if (best) done(best.blob, best.q, best.kb); return; }
        var kb = blob.size / 1024;
        if (kb > targetKB) hi = q; else lo = q;
        best = { blob: blob, q: q, kb: kb };
        if (attempts < 6 && Math.abs(kb - targetKB) > targetKB * 0.06) step();
        else {
          // final encode at low estimate to stay under limit
          c.toBlob(function (fin) { var fk = fin.size / 1024; done(fin, lo, fk); }, 'image/jpeg', Math.max(0.2, lo));
        }
      }, 'image/jpeg', q);
    }
    step();
  }
  $('#downloadBtn').addEventListener('click', function () {
    if (!outBlob) return;
    var a = document.createElement('a');
    a.href = URL.createObjectURL(outBlob);
    a.download = 'shebaghor-' + (+$('#wInput').value || 0) + 'x' + (+$('#hInput').value || 0) + '.jpg';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  });
});
