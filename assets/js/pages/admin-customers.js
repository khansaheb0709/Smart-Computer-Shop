/* সেবাঘর — admin customer list + file library (aggregated from orders) */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { var d = document.createElement('div'); d.textContent = String(s == null ? '' : s); return d.innerHTML; };
  var bnDigits = function (s) { return String(s == null ? '' : s).replace(/[0-9]/g, function (d) { return '০১২৩৪৫৬৭৮৯'[+d]; }); };
  var fmtDate = function (iso) { return iso ? bnDigits(String(iso).slice(0, 10)) : '—'; };
  var all = [];          // enriched order rows
  var customers = [];    // aggregated

  (async function init () {
    if (!window.SB || !SB.client) { return; }
    var { data: { session } } = await SB.client.auth.getSession();
    if (!session) { location.replace('login.html?next=admin-customers.html'); return; }
    var role = await SB.requireAdmin();
    if (role !== 'admin') { $('#gate403').hidden = false; return; }
    $('#adminArea').hidden = false;
    $('#loadInfo').textContent = 'লোড হচ্ছে…';
    var res = await SB.client.from('orders')
      .select('id, order_date, token, status, total, paid, guest_name, guest_phone, customer_id, created_at')
      .order('created_at', { ascending: false })
      .limit(1500);
    if (res.error) { $('#loadInfo').textContent = 'লোড ব্যর্থ: ' + res.error.message; return; }
    all = res.data || [];
    // profile lookup for account customers
    var ids = Array.from(new Set(all.map(function (o) { return o.customer_id; }).filter(Boolean)));
    var prof = {};
    if (ids.length) {
      var pr = await SB.client.from('profiles').select('id, full_name, phone').in('id', ids);
      (pr.data || []).forEach(function (p) { prof[p.id] = p; });
    }
    all.forEach(function (o) {
      var p = o.customer_id ? prof[o.customer_id] : null;
      o._name = (p && p.full_name) || o.guest_name || 'গেস্ট কাস্টমার';
      o._phone = (p && p.phone) || o.guest_phone || '';
      o._key = o.customer_id ? 'u:' + o.customer_id : (o.guest_phone ? 'g:' + o.guest_phone : 'anon:' + o.id);
    });
    var map = {};
    all.forEach(function (o) {
      var c = map[o._key];
      if (!c) c = map[o._key] = { key: o._key, name: o._name, phone: o._phone, orders: [], total: 0, paid: 0, last: '' };
      c.orders.push(o); c.total += o.total || 0; c.paid += o.paid || 0;
      if ((o.order_date || '') > c.last) c.last = o.order_date || '';
      if (!c.name && o._name) c.name = o._name;
    });
    customers = Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return (b.last || '').localeCompare(a.last || ''); });
    $('#loadInfo').textContent = bnDigits(customers.length) + ' জন কাস্টমার · ' + bnDigits(all.length) + 'টি অর্ডার (সাম্প্রতিক ১৫০০)';
    renderList('');
  })();

  $('#searchInput').addEventListener('input', function () { renderList($('#searchInput').value.trim().toLowerCase()); });

  function renderList(q) {
    var listEl = $('#custList');
    listEl.innerHTML = '';
    var matches = customers.filter(function (c) {
      if (!q) return true;
      return (c.name || '').toLowerCase().indexOf(q) > -1 || (c.phone || '').indexOf(q.replace(/\D/g, '') || q) > -1;
    }).slice(0, 200);
    matches.forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'cust-item'; b.type = 'button';
      b.innerHTML = '<span class="cust-name">' + esc(c.name) + '</span><br><span class="cust-sub">' +
        (c.phone ? '📱 ' + bnDigits(c.phone) + ' · ' : '') + bnDigits(c.orders.length) + 'টি কাজ · সর্বমোট ৳' + bnDigits(c.total) + ' · শেষ: ' + fmtDate(c.last) + '</span>';
      b.addEventListener('click', function () {
        listEl.querySelectorAll('.cust-item').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        showDetail(c);
      });
      listEl.appendChild(b);
    });
    if (!matches.length) listEl.innerHTML = '<p class="muted">কোনো মিল নেই।</p>';
  }

  async function showDetail(c) {
    var el = $('#custDetail');
    el.innerHTML = '<p class="muted">লোড হচ্ছে…</p>';
    var ids = c.orders.map(function (o) { return o.id; });
    var [itemsRes, filesRes, proofsRes] = await Promise.all([
      SB.client.from('order_items').select('order_id, name_snapshot, qty, unit_price, line_total').in('order_id', ids),
      SB.client.from('order_files').select('id, order_id, file_path, original_name, mime, size_bytes, kind, uploaded_at').in('order_id', ids).order('uploaded_at', { ascending: false }),
      SB.client.from('design_proofs').select('id, order_id, round, file_path, status').in('order_id', ids)
    ]);
    var itemCount = {};
    (itemsRes.data || []).forEach(function (i) { itemCount[i.order_id] = (itemCount[i.order_id] || 0) + 1; });
    var files = (filesRes.data || []).slice();
    (proofsRes.data || []).forEach(function (p) {
      files.push({ id: 'proof-' + p.id, order_id: p.order_id, file_path: p.file_path, original_name: 'proof-r' + p.round + '.pdf', mime: 'proof', size_bytes: 0, kind: 'proof', uploaded_at: null });
    });
    var html = '<div class="card"><h2>' + esc(c.name) + (c.phone ? ' <a href="tel:' + esc(c.phone) + '" class="hint" style="font-weight:400">📱 ' + bnDigits(c.phone) + '</a>' : '') + '</h2>' +
      '<p class="muted">' + bnDigits(c.orders.length) + 'টি কাজ · সর্বমোট ৳' + bnDigits(c.total) + ' · পরিশোধিত ৳' + bnDigits(c.paid) + ' · বকেয়া ৳' + bnDigits(c.total - c.paid) + '</p></div>';
    /* orders */
    html += '<div class="card" style="margin-top:var(--sp-3)"><h2>কাজের ইতিহাস</h2>' +
      c.orders.map(function (o) {
        return '<div class="cv-row" style="border-bottom:1px solid var(--line);padding:6px 0"><span><b>' + fmtDate(o.order_date) + '</b> · টোকেন ' + bnDigits(o.token) + ' · ' + esc(o.status) + (itemCount[o.id] ? ' · ' + bnDigits(itemCount[o.id]) + ' লাইন' : '') + '</span><span>৳' + bnDigits(o.total) + '</span></div>';
      }).join('') + '</div>';
    /* file library */
    html += '<div class="card" style="margin-top:var(--sp-3)"><h2>ফাইল লাইব্রেরি (' + bnDigits(files.length) + ')</h2>';
    if (!files.length) html += '<p class="muted">কোনো ফাইল নেই।</p>';
    else {
      html += '<div class="file-grid">';
      files.forEach(function (f) {
        var fname = esc(f.original_name || 'ফাইল');
        var kindBn = { source: 'সোর্স', proof: 'প্রুফ', nid: 'NID' }[f.kind] || esc(f.kind || 'file');
        var size = f.size_bytes ? ' · ' + bnDigits(Math.round(f.size_bytes / 1024)) + ' KB' : '';
        html += '<div class="file-item"><b>' + kindBn + '</b><br>' + fname + '<div class="hint">' + (f.uploaded_at ? fmtDate(f.uploaded_at) : '') + size + '</div><button class="btn btn-ghost btn-small file-dl" style="margin-top:6px" data-path="' + esc(f.file_path) + '">ডাউনলোড</button></div>';
      });
      html += '</div>';
    }
    html += '</div>';
    el.innerHTML = html;
    el.querySelectorAll('.file-dl').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var path = btn.getAttribute('data-path');
        var bucket = 'order-files';
        var p = String(path);
        if (p.indexOf('proofs/') === 0) { bucket = 'proofs'; p = p.slice('proofs/'.length); }
        else if (p.indexOf('order-files/') === 0) { p = p.slice('order-files/'.length); }
        btn.textContent = '…';
        var res = await SB.client.storage.from(bucket).createSignedUrl(p, 300);
        if (res.error) { btn.textContent = 'ব্যর্থ'; alert('লিংক তৈরি ব্যর্থ: ' + res.error.message); return; }
        window.open(res.data.signedUrl, '_blank', 'noopener');
        btn.textContent = 'ডাউনলোড';
      });
    });
  }
});
