/* সেবাঘর — handwriting OCR (Tesseract.js, fully local assets) */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
  var $ = function (s) { return document.querySelector(s); };
  var srcCanvas = $('#srcPreview');           // visible source canvas
  var workCanvas = null;                       // enhanced canvas fed to OCR
  var stream = null, worker = null, running = false;
  var bnDigits = '০১২৩৪৫৬৭৮৯';
  function toBn(s) { return String(s).replace(/[0-9]/g, function (d) { return bnDigits[+d]; }); }
  function absUrl(p) { return new URL(p, window.location.href).href; }

  function loadImageFile(file) {
    var img = new Image();
    img.onload = function () {
      var maxDim = 2200, s = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      srcCanvas.width = Math.max(1, Math.round(img.naturalWidth * s));
      srcCanvas.height = Math.max(1, Math.round(img.naturalHeight * s));
      srcCanvas.style.display = 'block';
      srcCanvas.getContext('2d').drawImage(img, 0, 0, srcCanvas.width, srcCanvas.height);
      URL.revokeObjectURL(img.src);
      $('#workPanel').hidden = false;
      $('#resultText').value = '';
      updateCount();
    };
    img.src = URL.createObjectURL(file);
  }
  $('#fileInput').addEventListener('change', function (e) { var f = e.target.files[0]; if (f) loadImageFile(f); });

  /* camera */
  $('#cameraBtn').addEventListener('click', async function () {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false });
      var v = $('#camVideo'); v.srcObject = stream; v.style.display = 'block'; await v.play();
      $('#camRow').style.display = 'flex';
    } catch (err) { alert('ক্যামেরা খোলা যায়নি — অনুমতি দিন।'); }
  });
  function stopCam() { if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } $('#camVideo').style.display = 'none'; $('#camRow').style.display = 'none'; }
  $('#camStopBtn').addEventListener('click', stopCam);
  $('#camSnapBtn').addEventListener('click', function () {
    var v = $('#camVideo'); if (!v.videoWidth) return;
    var c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    var img = new Image();
    img.onload = function () {
      srcCanvas.width = img.naturalWidth; srcCanvas.height = img.naturalHeight;
      srcCanvas.style.display = 'block';
      srcCanvas.getContext('2d').drawImage(img, 0, 0);
      $('#workPanel').hidden = false; $('#resultText').value = ''; updateCount();
    };
    img.src = c.toDataURL('image/jpeg', 0.92);
    stopCam();
  });

  /* enhance: grayscale + percentile contrast stretch */
  function buildWorkCanvas() {
    workCanvas = document.createElement('canvas');
    workCanvas.width = srcCanvas.width; workCanvas.height = srcCanvas.height;
    var wctx = workCanvas.getContext('2d');
    wctx.drawImage(srcCanvas, 0, 0);
    if (!$('#enhanceChk').checked) return workCanvas;
    var d = wctx.getImageData(0, 0, workCanvas.width, workCanvas.height), px = d.data;
    var hist = new Uint32Array(256);
    for (var i = 0; i < px.length; i += 4) {
      var l = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) | 0;
      hist[l]++;
    }
    var total = px.length / 4, lo = 0, hi = 255, acc = 0, clip = Math.max(1, Math.floor(total * 0.02));
    for (var i = 0; i < 256; i++) { acc += hist[i]; if (acc > clip) { lo = i; break; } }
    acc = 0;
    for (var i = 255; i >= 0; i--) { acc += hist[i]; if (acc > clip) { hi = i; break; } }
    if (hi <= lo) { lo = 0; hi = 255; }
    var scale = 255 / (hi - lo);
    for (var i = 0; i < px.length; i += 4) {
      var l2 = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) | 0;
      var v = Math.round((l2 - lo) * scale);
      v = v < 0 ? 0 : v > 255 ? 255 : v;
      px[i] = px[i + 1] = px[i + 2] = v;
    }
    wctx.putImageData(d, 0, 0);
    return workCanvas;
  }

  function setStatus(t) { $('#statusText').textContent = t; }
  function setProgress(p) { var el = $('#ocrProgress'); el.style.display = 'block'; el.value = Math.round(p * 100); }

  async function runOcr() {
    if (running) return;
    if (!srcCanvas.width) { alert('আগে একটি ছবি দিন।'); return; }
    running = true; $('#runBtn').disabled = true;
    var prog = $('#ocrProgress'); prog.style.display = 'block'; prog.value = 0;
    setStatus('মডেল লোড হচ্ছে… (প্রথমবার কয়েক সেকেন্ড লাগে)');
    try {
      var lang = $('#langSel').value;
      var canvas = buildWorkCanvas();
      if (worker) { try { await worker.terminate(); } catch (e) {} worker = null; }
      worker = await Tesseract.createWorker(lang, 1 /* LSTM_ONLY */, {
        workerPath: absUrl('../assets/js/vendor-tesseract-worker.min.js'),
        corePath: absUrl('../assets/js/'),   // directory; worker auto-picks simd-lstm build
        langPath: absUrl('../assets/ocr/'),
        gzip: true,
        logger: function (m) {
          if (m.status === 'recognizing text') { setProgress(m.progress || 0); setStatus('চিহ্নিত হচ্ছে… ' + Math.round((m.progress || 0) * 100) + '%'); }
          else if (m.status) { setStatus(String(m.status).replace(/^[a-z]/, function (c) { return c.toUpperCase(); })); if (typeof m.progress === 'number') setProgress(m.progress); }
        }
      });
      var ret = await worker.recognize(canvas);
      var text = (ret && ret.data && ret.data.text || '').trim();
      $('#resultText').value = text;
      setProgress(1);
      setStatus(text ? 'সম্পন্ন — মিলিয়ে ঠিক করে নিন।' : 'কিছু চিনতে পারিনি — পরিষ্কার/সোজা ছবি দিন।');
    } catch (err) {
      console.error(err);
      setStatus('ত্রুটি: ' + (err && err.message ? err.message : 'অজানা'));
      alert('OCR ব্যর্থ হয়েছে। ছবি সোজা ও আলোযুক্ত কিনা দেখে আবার চেষ্টা করুন।');
    } finally {
      running = false; $('#runBtn').disabled = false;
      setTimeout(function () { prog.style.display = 'none'; }, 1200);
    }
  }
  $('#runBtn').addEventListener('click', runOcr);

  function updateCount() {
    var t = $('#resultText').value.trim();
    $('#wordCount').textContent = toBn(String(t ? t.split(/\s+/).length : 0));
  }
  $('#resultText').addEventListener('input', updateCount);

  /* Word (.doc) export — HTML with UTF-8 BOM opens perfectly in Word/LibreOffice/Google Docs */
  function buildDocHtml(text) {
    var esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var paragraphs = esc.split(/\n{2,}/).map(function (p) { return '<p>' + p.replace(/\n/g, '<br>') + '</p>'; }).join('\n');
    return '<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
      '<head><meta charset="utf-8"><title>সেবাঘর দলিল</title>' +
      '<style>@page WordSection1{size:21cm 29.7cm;margin:2cm}div.WordSection1{page:WordSection1}' +
      'body{font-family:"Kalpurush","Noto Serif Bengali","Nirmala UI",serif;font-size:12pt;line-height:1.6;color:#111}p{margin:0 0 10pt}</style>' +
      '</head><body><div class="WordSection1">' + paragraphs + '</div></body></html>';
  }
  $('#wordBtn').addEventListener('click', function () {
    var text = $('#resultText').value.trim();
    if (!text) { alert('আগে টেক্সট তৈরি বা লিখুন।'); return; }
    var blob = new Blob(['﻿' + buildDocHtml(text)], { type: 'application/msword' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'shebaghor-handwriting.doc'; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  });
  $('#copyBtn').addEventListener('click', async function () {
    var text = $('#resultText').value;
    try { await navigator.clipboard.writeText(text); $('#copyBtn').textContent = '✅ কপি হয়েছে'; setTimeout(function () { $('#copyBtn').textContent = '📋 কপি'; }, 1500); }
    catch (e) { $('#resultText').select(); document.execCommand('copy'); }
  });
  $('#printBtn').addEventListener('click', function () {
    var text = $('#resultText').value.trim();
    if (!text) { alert('আগে টেক্সট তৈরি বা লিখুন।'); return; }
    var mount = $('#printMount'), doc = $('#printDoc');
    doc.innerHTML = buildDocHtml(text).replace(/[\s\S]*?<body>/, '').replace(/<\/body>[\s\S]*$/, '');
    mount.style.display = 'block';
    window.print();
    setTimeout(function () { mount.style.display = 'none'; doc.innerHTML = ''; }, 800);
  });
});
