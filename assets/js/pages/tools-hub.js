/* সেবাঘর — tools hub */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
  var tools = [
    { href: 'passport-photo.html', ico: '📸', t: 'পাসপোর্ট ছবি', d: 'ছবি দিন → retouch, ব্যাকগ্রাউন্ড বদল → A4 প্রিন্ট-রেডি শিট', tag: 'সবচেয়ে জনপ্রিয়' },
    { href: 'document-scan.html', ico: '📄', t: 'ডকুমেন্টস (A4 স্ক্যান)', d: 'বাঁকা ছবি সোজা, ছায়া পরিষ্কার — যেকোনো ছবি থেকে পরিষ্কার A4', tag: '' },
    { href: 'id-card.html', ico: '🪪', t: 'আইডি কার্ড', d: 'সামনের-পিছন ছবি → এক পাতায় প্রিন্ট-রেডি CR80', tag: '' },
    { href: 'image-resize.html', ico: '🖼️', t: 'ছবি রিসাইজ', d: 'পাসপোর্ট/NID সাইজ, সাইজ-প্রেসেট, KB কমানো JPEG', tag: '' },
    { href: 'handwriting.html', ico: '✍️', t: 'হাতের লেখা → ওয়ার্ড', d: 'ছবি দিন → Tesseract দিয়ে টেক্সট (eng+ben) — ছাপার মতো লেহায় সেরা ফল', tag: 'BETA' },
    { href: 'cv.html', ico: '🧾', t: 'সিভি তৈরি', d: '১০টি ডিজাইন, বাংলা-ইংরেজি — আজকেরই PDF-এ সেভ', tag: '' },
    { href: 'signature.html', ico: '🖊️', t: 'সিগনেচার', d: 'আঙুল/ঘড়ি দিয়ে আঁকুন → transparent PNG ডাউনলোড', tag: '' },
    { href: 'qr-code.html', ico: '🔳', t: 'QR কোড (গাড়ি/ব্যবসার)', d: 'যেকোনো লেখা/লিংক → QR PNG/SVG ডাউনলোড বা প্রিন্ট', tag: '' },
    { href: 'calculator.html', ico: '🧮', t: 'হিসাব ও ক্যালকুলেটর', d: 'সাধারণ ক্যালকুলেটর + দোকানের হিসাব (ছাড় %, ভ্যাট %, বাকি)', tag: '' },
    { href: '../internal/index.html', ico: '📑', t: 'রেডিমেড কাগজপত্র', d: 'আবেদনপত্র, দলিল, বয়ান — দলিল সহায়কে স্যাম্পল নিয়ে লিখুন', tag: '' },
    { href: '../jobs.html', ico: '💼', t: 'জব বোর্ড', d: 'দোকানের চাকরির বিজ্ঞপ্তি — WhatsApp-এ আবেদন করুন', tag: '' },
  ];
  var grid = document.getElementById('toolsGrid');
  for (var i = 0; i < tools.length; i++) {
    var t = tools[i];
    var a = document.createElement('a');
    a.className = 'tool-card'; a.href = t.href;
    a.innerHTML = '<span class="tool-ico" aria-hidden="true">' + t.ico + '</span>' +
      '<h2>' + t.t + '</h2><p>' + t.d + '</p>' + (t.tag ? '<span class="tool-tag">' + t.tag + '</span>' : '');
    grid.appendChild(a);
  }
});
