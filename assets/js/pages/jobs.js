/* সেবাঘর — public jobs board (active posts; WhatsApp apply) */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
  var grid = document.getElementById('jobsGrid');
  var catRow = document.getElementById('catRow');
  var CATS = [['all','সব'],['govt','সরকারি'],['private','প্রাইভেট'],['factory','ফ্যাক্টরি'],['shop','দোকান'],['driver','ড্রাইভিং'],['computer','কম্পিউটার'],['tailoring','দর্জি'],['other','অন্যান্য']];
  var TYPES = { full_time: 'ফুল-টাইম', part_time: 'পার্ট-টাইম', contract: 'চুক্তিভিত্তিক', temporary: 'সাময়িক' };
  var cat = 'all';
  function bnDigits(s) { return String(s == null ? '' : s).replace(/[0-9]/g, function (d) { return '০১২৩৪৫৬৭৮৯'[+d]; }); }
  CATS.forEach(function (c) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-ghost btn-small' + (c[0] === cat ? ' btn-primary' : '');
    b.textContent = c[1];
    b.addEventListener('click', function () {
      cat = c[0];
      catRow.querySelectorAll('button').forEach(function (x) { x.className = 'btn btn-ghost btn-small'; });
      b.className = 'btn btn-primary btn-small';
      render();
    });
    catRow.appendChild(b);
  });
  var posts = [];
  function waLink(phone, title) {
    var text = encodeURIComponent('আসসালামু আলাইকুম, বিজ্ঞপ্তি "' + title + '" — কাজের জন্য যোগাযোগ করছি।');
    return 'https://wa.me/88' + phone.replace(/^0/, '') + '?text=' + text;
  }
  function render() {
    var list = posts.filter(function (p) { return cat === 'all' || p.category === cat; });
    if (!list.length) { grid.innerHTML = '<p class="muted">এই মুহূর্তে কোনো বিজ্ঞপ্তি নেই। পরে আবার দেখুন — বা দোকানে এসে বলুন।</p>'; return; }
    grid.innerHTML = '';
    list.forEach(function (p) {
      var d = document.createElement('article');
      d.className = 'job-card';
      var deadline = p.deadline ? '<span>শেষ তারিখ: ' + bnDigits(p.deadline) + '</span>' : '';
      var salary = p.salary_bn ? '<span>বেতন: ' + esc(p.salary_bn) + '</span>' : '';
      var loc = p.location_bn ? '<span>স্থান: ' + esc(p.location_bn) + '</span>' : '';
      d.innerHTML = '<span class="badge">' + esc(TYPES[p.job_type] || 'ফুল-টাইম') + '</span>' +
        '<h2>' + esc(p.title_bn) + '</h2>' +
        '<div class="job-meta"><span>প্রতিষ্ঠান: ' + esc(p.company) + '</span>' + salary + loc + deadline + '</div>' +
        '<p style="white-space:pre-line;margin:0 0 8px">' + esc(p.description_bn) + '</p>' +
        (p.requirements_bn ? '<p class="hint" style="white-space:pre-line;margin:0 0 10px"><b>যোগ্যতাই:</b><br>' + esc(p.requirements_bn) + '</p>' : '') +
        '<a class="btn btn-primary" href="' + waLink(p.whatsapp, p.title_bn) + '" target="_blank" rel="noopener noreferrer">📱 WhatsApp-এ আবেদন</a>';
      grid.appendChild(d);
    });
  }
  function esc(s) { var d = document.createElement('div'); d.textContent = String(s == null ? '' : s); return d.innerHTML; }
  async function load() {
    if (!window.SB || !SB.client) { grid.innerHTML = '<p class="muted">সেবা সংযোগ নেই — পরে আবার চেষ্টা করুন।</p>'; return; }
    var res = await SB.client.from('job_posts').select('*').eq('active', true).order('created_at', { ascending: false });
    if (res.error) { grid.innerHTML = '<p class="muted">বিজ্ঞপ্তি আনা যায়নি — পরে আবার চেষ্টা করুন।</p>'; return; }
    posts = res.data || [];
    render();
  }
  load();
});
