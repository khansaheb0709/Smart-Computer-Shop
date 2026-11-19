/* সেবাঘর — CV builder: 10 templates, Bengali+English, print/Word export */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
  var $ = function (s) { return document.querySelector(s); };
  var photoUrl = null, template = 'cv-t1';
  var TEMPLATES = [
    { id: 'cv-t1', name: 'Emerald', sw: '#0d3b2e' }, { id: 'cv-t2', name: 'Navy Gold', sw: '#16294d' },
    { id: 'cv-t3', name: 'Maroon', sw: '#6e1423' }, { id: 'cv-t4', name: 'Teal', sw: '#0f5e63' },
    { id: 'cv-t5', name: 'Classic', sw: '#111' }, { id: 'cv-t6', name: 'Sidebar', sw: '#0d3b2e' },
    { id: 'cv-t7', name: 'Minimal', sw: '#888' }, { id: 'cv-t8', name: 'Royal Blue', sw: '#1a3a7a' },
    { id: 'cv-t9', name: 'Warm Serif', sw: '#5a3a1a' }, { id: 'cv-t10', name: 'Crimson', sw: '#b3001b' }
  ];
  var tplGrid = $('#tplGrid');
  TEMPLATES.forEach(function (t) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'tpl-btn'; b.setAttribute('role', 'radio'); b.dataset.id = t.id;
    b.innerHTML = '<div class="tpl-swatch" style="background:' + t.sw + '"></div>' + t.name;
    b.addEventListener('click', function () {
      template = t.id;
      tplGrid.querySelectorAll('.tpl-btn').forEach(function (x) { x.classList.toggle('active', x === b); });
      render();
    });
    if (t.id === template) b.classList.add('active');
    tplGrid.appendChild(b);
  });

  /* dynamic education/experience rows */
  function rowHtml(prefix, ph1, ph2) {
    var div = document.createElement('div');
    div.className = 'row-2';
    div.innerHTML = '<div class="field"><input class="' + prefix + '-a" placeholder="' + ph1 + '"></div>' +
      '<div class="field" style="display:flex;gap:6px"><input class="' + prefix + '-b" placeholder="' + ph2 + '"><button type="button" class="btn btn-ghost btn-small row-remove" style="min-width:44px">✕</button></div>';
    div.querySelector('.row-remove').addEventListener('click', function () { div.remove(); render(); });
    div.querySelectorAll('input').forEach(function (i) { i.addEventListener('input', render); });
    return div;
  }
  $('#addEduBtn').addEventListener('click', function () { $('#eduRows').appendChild(rowHtml('edu', 'পরীক্ষা ও প্রতিষ্ঠান', 'বছর / বিভাগ')); render(); });
  $('#addExpBtn').addEventListener('click', function () { $('#expRows').appendChild(rowHtml('exp', 'পদবী / প্রতিষ্ঠান', 'সময়কাল')); render(); });

  ['fNameBn','fNameEn','fTitleBn','fTitleEn','fPhone','fEmail','fAddress','fDob','fNationality','fObjective','fSkills','fLanguages'].forEach(function (id) {
    $('#' + id).addEventListener('input', render);
  });
  $('#fPhoto').addEventListener('change', function (e) {
    var f = e.target.files[0]; if (!f) { photoUrl = null; render(); return; }
    var r = new FileReader(); r.onload = function () { photoUrl = r.result; render(); }; r.readAsDataURL(f);
  });

  function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function collect() {
    return {
      nameBn: $('#fNameBn').value.trim(), nameEn: $('#fNameEn').value.trim(),
      titleBn: $('#fTitleBn').value.trim(), titleEn: $('#fTitleEn').value.trim(),
      phone: $('#fPhone').value.trim(), email: $('#fEmail').value.trim(), address: $('#fAddress').value.trim(),
      dob: $('#fDob').value.trim(), nationality: $('#fNationality').value.trim(),
      objective: $('#fObjective').value.trim(),
      skills: $('#fSkills').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      languages: $('#fLanguages').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      education: Array.prototype.slice.call($('#eduRows').children).map(function (r) {
        return { a: r.querySelector('.edu-a').value.trim(), b: r.querySelector('.edu-b').value.trim() };
      }).filter(function (r) { return r.a || r.b; }),
      experience: Array.prototype.slice.call($('#expRows').children).map(function (r) {
        return { a: r.querySelector('.exp-a').value.trim(), b: r.querySelector('.exp-b').value.trim() };
      }).filter(function (r) { return r.a || r.b; })
    };
  }
  function rowsHtml(rows) {
    if (!rows.length) return '';
    return rows.map(function (r) {
      return '<div class="cv-row"><span><b>' + esc(r.a) + '</b></span><span style="color:#666">' + esc(r.b) + '</span></div>';
    }).join('');
  }
  function tagsHtml(list) { return list.map(function (s) { return '<span class="cv-tag">' + esc(s) + '</span>'; }).join(''); }
  function buildInner(d) {
    var name = d.nameBn || d.nameEn || 'আপনার নাম';
    var nameAlt = d.nameBn && d.nameEn && d.nameEn !== d.nameBn ? '<span style="font-size:14px;color:#666"> · ' + esc(d.nameEn) + '</span>' : '';
    var title = d.titleBn || d.titleEn || '';
    var titleAlt = d.titleBn && d.titleEn && d.titleEn !== d.titleBn ? ' · ' + esc(d.titleEn) : '';
    var contact = [d.phone, d.email, d.address].filter(Boolean).map(esc).join(' · ');
    var meta = [d.dob ? 'জন্ম: ' + esc(d.dob) : '', d.nationality ? 'জাতীয়তা: ' + esc(d.nationality) : ''].filter(Boolean).join(' · ');
    var photo = photoUrl ? '<img class="cv-photo" src="' + photoUrl + '" alt="ছবি">' : '';
    var blocks = '';
    if (d.objective) blocks += '<h2>সারাংশ</h2><p style="margin:0">' + esc(d.objective) + '</p>';
    if (d.education.length) blocks += '<h2>শিক্ষাগত যোগ্যতা</h2>' + rowsHtml(d.education);
    if (d.experience.length) blocks += '<h2>অভিজ্ঞতা</h2>' + rowsHtml(d.experience);
    if (d.skills.length) blocks += '<h2>দক্ষতা</h2><div>' + tagsHtml(d.skills) + '</div>';
    if (d.languages.length) blocks += '<h2>ভাষা</h2><div>' + tagsHtml(d.languages) + '</div>';
    if (template === 'cv-t6') {
      return '<div class="cv-sidebar"><div class="cv-sidebar-inner">' + photo +
        '<div style="font-size:17px;font-weight:700;line-height:1.3">' + esc(name) + '</div>' +
        '<div style="opacity:.85;margin:2px 0 10px">' + esc(title) + '</div>' +
        (contact ? '<div style="font-size:10.5px;opacity:.9">' + contact.replace(/ · /g, '<br>') + '</div>' : '') +
        (d.languages.length ? '<h2 style="color:#ffe9a8;border-color:rgba(255,255,255,.35);font-size:11px">ভাষা</h2>' + tagsHtml(d.languages) : '') +
        '</div><div style="padding:22px 24px">' + (d.objective ? '<h2>সারাংশ</h2><p style="margin:0">' + esc(d.objective) + '</p>' : '') +
        (d.education.length ? '<h2>শিক্ষাগত যোগ্যতা</h2>' + rowsHtml(d.education) : '') +
        (d.experience.length ? '<h2>অভিজ্ঞতা</h2>' + rowsHtml(d.experience) : '') +
        (d.skills.length ? '<h2>দক্ষতা</h2><div>' + tagsHtml(d.skills) + '</div>' : '') +
        '</div></div>';
    }
    return photo +
      '<h1>' + esc(name) + nameAlt + '</h1>' +
      (title ? '<div class="cv-title">' + esc(title) + titleAlt + '</div>' : '') +
      (contact ? '<div class="cv-contact">' + contact + (meta ? '<br>' + meta : '') + '</div>' : (meta ? '<div class="cv-contact">' + meta + '</div>' : '')) +
      blocks;
  }
  function render() {
    var d = collect();
    var pv = $('#cvPreview');
    pv.className = 'cv-sheet ' + template;
    pv.innerHTML = buildInner(d);
  }
  // seed example rows
  $('#eduRows').appendChild(rowHtml('edu', 'পরীক্ষা ও প্রতিষ্ঠান', 'বছর / বিভাগ'));
  $('#expRows').appendChild(rowHtml('exp', 'পদবী / প্রতিষ্ঠান', 'সময়কাল'));
  render();

  function buildDocHtml() {
    var d = collect();
    var inner = buildInner(d);
    return '<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>CV</title>' +
      '<style>body{font-family:"Kalpurush","Noto Serif Bengali","Nirmala UI",serif;font-size:11pt;line-height:1.5;color:#111;margin:1.5cm}h1{font-size:20pt}h2{font-size:12pt;text-transform:uppercase;border-bottom:1px solid #999;padding-bottom:2pt}.cv-tag{border:1px solid #888;padding:0 6pt;font-size:9pt}</style>' +
      '</head><body>' + inner + '</body></html>';
  }
  $('#wordBtn').addEventListener('click', function () {
    var blob = new Blob(['﻿' + buildDocHtml()], { type: 'application/msword' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'shebaghor-cv.doc'; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  });
  $('#printBtn').addEventListener('click', function () {
    var mount = $('#printMount');
    mount.innerHTML = '<div class="cv-sheet ' + template + '" style="border:none;box-shadow:none;max-width:none;padding:0">' + buildInner(collect()) + '</div>';
    mount.style.display = 'block';
    window.print();
    setTimeout(function () { mount.style.display = 'none'; mount.innerHTML = ''; }, 800);
  });
  $('#resetBtn').addEventListener('click', function () { $('#cvForm').reset(); $('#eduRows').innerHTML = ''; $('#expRows').innerHTML = ''; photoUrl = null; $('#eduRows').appendChild(rowHtml('edu', 'পরীক্ষা ও প্রতিষ্ঠান', 'বছর / বিভাগ')); $('#expRows').appendChild(rowHtml('exp', 'পদবী / প্রতিষ্ঠান', 'সময়কাল')); render(); });
});
