/* সেবাঘর — admin-reports page logic (extracted from admin-reports.html inline <script>; DCL-guarded inside) */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
(function () {
  const { $, esc, fmtMoney, toBnDigits, toast, normalizePhone } = window.DG;
  const S = window.STRINGS.status;
  let bnDigits = true;
  let view = 'summary';
  let rangeOrders = [], duesOrders = [], customers = {};

  SB.setupBanner();

  const fmt = n => bnDigits ? toBnDigits(fmtMoney(n)) : fmtMoney(n);
  const bn = v => bnDigits ? toBnDigits(String(v)) : String(v);
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const bnToken = t => toBnDigits('টি-' + String(t).padStart(3, '0'));
  const waIntl = phone => { const p = normalizePhone(phone || ''); return p.startsWith('0') ? '880' + p.slice(1) : p; };

  /* ===== data loading ===== */
  async function loadSettings() {
    const { data: s } = await SB.client.from('shop_settings').select('bn_digits').eq('id', 1).maybeSingle();
    bnDigits = !s || s.bn_digits !== false;
  }

  async function loadRange() {
    const from = $('#fromDate').value, to = $('#toDate').value;
    if (!from || !to) return;
    $('#rangeHint').textContent = 'লোড হচ্ছে…';
    const { data, error } = await SB.client.from('orders')
      .select('id, order_date, token, status, total, paid, due, guest_name, guest_phone, customer_id, payment_method, payment_status, created_at')
      .gte('order_date', from).lte('order_date', to)
      .order('created_at', { ascending: false });
    if (error) { $('#rangeHint').textContent = ''; toast(window.STRINGS.errors.generic); return; }
    rangeOrders = data || [];
    customers = await fetchProfiles(rangeOrders);
    renderSummary();
    $('#rangeHint').textContent = rangeOrders.length + 'টি অর্ডার';
  }

  async function loadDues() {
    const { data, error } = await SB.client.from('orders')
      .select('id, order_date, token, status, total, paid, due, guest_name, guest_phone, customer_id, created_at')
      .gt('due', 0).neq('status', 'cancelled')
      .order('due', { ascending: false });
    if (error) { toast(window.STRINGS.errors.generic); return; }
    duesOrders = data || [];
    customers = Object.assign(customers, await fetchProfiles(duesOrders));
    renderDues();
  }

  async function fetchProfiles(list) {
    const ids = [...new Set(list.map(o => o.customer_id).filter(Boolean))];
    const map = {};
    if (ids.length) {
      const { data: profs } = await SB.client.from('profiles').select('id, full_name, phone').in('id', ids);
      (profs || []).forEach(p => { map[p.id] = p; });
    }
    return map;
  }

  const cname = o => o.guest_name || customers[o.customer_id]?.full_name || 'গ্রাহক';
  const cphone = o => o.guest_phone || customers[o.customer_id]?.phone || '';

  /* ===== render: summary ===== */
  async function renderSummary() {
    const live = rangeOrders.filter(o => o.status !== 'cancelled');
    const paidSum = live.reduce((s, o) => s + (o.paid || 0), 0);
    const dueSum = live.reduce((s, o) => s + (o.due || 0), 0);
    $('#cardOrders').textContent = bn(rangeOrders.length);
    $('#cardRevenue').textContent = fmt(paidSum);
    $('#cardDue').textContent = fmt(dueSum);
    $('#cardPending').textContent = bn(rangeOrders.filter(o => o.status === 'pending_verification').length);

    const tbody = $('#ordersTableBody');
    $('#ordersTableEmpty').hidden = rangeOrders.length > 0;
    tbody.innerHTML = rangeOrders.map(o =>
      '<tr><td>' + esc(new Date(o.order_date).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' })) + '</td>' +
      '<td><a href="admin-order.html?id=' + encodeURIComponent(o.id) + '" style="color:var(--green-700);font-weight:700">' + bnToken(o.token) + '</a></td>' +
      '<td>' + esc(cname(o)) + '</td>' +
      '<td><span class="badge" data-status="' + esc(o.status) + '">' + esc(S[o.status] || o.status) + '</span></td>' +
      '<td class="num">' + fmt(o.total) + '</td>' +
      '<td class="num">' + (o.due > 0 ? fmt(o.due) : '—') + '</td></tr>'
    ).join('');

    // top-5 services by qty (line name snapshot)
    const topBox = $('#topServices'), topEmpty = $('#topServicesEmpty');
    const ids = rangeOrders.filter(o => o.status !== 'cancelled').map(o => o.id);
    const agg = {};
    if (ids.length) {
      const { data: items } = await SB.client.from('order_items').select('name_snapshot, qty').in('order_id', ids);
      (items || []).forEach(it => { agg[it.name_snapshot] = (agg[it.name_snapshot] || 0) + Number(it.qty); });
    }
    const top = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 5);
    topEmpty.hidden = top.length > 0;
    if (!top.length) { topBox.innerHTML = ''; }
    else {
      const max = top[0][1];
      topBox.innerHTML = top.map(([name, qty]) =>
        '<div><div class="row" style="justify-content:space-between; margin-bottom:2px"><span class="small" style="font-weight:600">' + esc(name) + '</span><span class="small muted">' + bn(Math.round(qty * 100) / 100) + '</span></div>' +
        '<div style="height:10px; background:var(--line); border-radius:5px; overflow:hidden"><div style="height:100%; width:' + Math.round(qty / max * 100) + '%; background:var(--green-600)"></div></div></div>'
      ).join('');
    }
  }

  /* ===== render: dues ===== */
  function renderDues() {
    const total = duesOrders.reduce((s, o) => s + (o.due || 0), 0);
    $('#duesTotal').textContent = fmt(total);
    $('#duesCount').textContent = bn(duesOrders.length);
    $('#duesEmpty').hidden = duesOrders.length > 0;
    $('#duesTableBody').innerHTML = duesOrders.map(o => {
      const phone = cphone(o);
      const wa = phone ? '<a class="btn btn-ghost btn-small" href="https://wa.me/' + waIntl(phone) + '?text=' +
        encodeURIComponent('সেবাঘর — বাকি ৳' + o.due + ' (অর্ডার ' + bnToken(o.token) + ') — দয়া করে পরিশোধ করুন।') +
        '" target="_blank" rel="noopener">wa.me</a>' : '<span class="small muted">নম্বর নেই</span>';
      return '<tr><td>' + esc(new Date(o.order_date).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: '2-digit' })) + '</td>' +
        '<td><a href="admin-order.html?id=' + encodeURIComponent(o.id) + '" style="color:var(--green-700);font-weight:700">' + bnToken(o.token) + '</a></td>' +
        '<td>' + esc(cname(o)) + '</td>' +
        '<td class="small">' + esc(phone || '—') + '</td>' +
        '<td class="num" style="color:var(--danger);font-weight:700">' + fmt(o.due) + '</td>' +
        '<td>' + wa + '</td></tr>';
    }).join('');
  }

  /* ===== CSV export (Latin digits, BOM, quoted) ===== */
  function csvCell(v) { return '"' + String(v ?? '').replace(/"/g, '""') + '"'; }
  function downloadCSV() {
    let header, rows, filename;
    if (view === 'dues') {
      header = ['order_date','token','customer','phone','due'];
      rows = duesOrders.map(o => [o.order_date, o.token, cname(o), cphone(o), o.due]);
      filename = 'shebaghor-dues-' + todayISO() + '.csv';
    } else {
      header = ['order_date','token','customer','phone','status','total','paid','due'];
      rows = rangeOrders.map(o => [o.order_date, o.token, cname(o), cphone(o), o.status, o.total, o.paid, o.due]);
      filename = 'shebaghor-orders-' + ($('#fromDate').value || todayISO()) + '_' + ($('#toDate').value || todayISO()) + '.csv';
    }
    const csv = '﻿' + [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ===== view switching + init ===== */
  $('#reportTabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-view]'); if (!btn) return;
    view = btn.getAttribute('data-view');
    document.querySelectorAll('#reportTabs .chip').forEach(c => {
      const on = c.getAttribute('data-view') === view;
      c.classList.toggle('active', on);
      c.setAttribute('aria-selected', String(on));
    });
    $('#view-summary').hidden = view !== 'summary';
    $('#view-dues').hidden = view !== 'dues';
    $('#csvBtn').textContent = view === 'dues' ? 'CSV (বাকি)' : 'CSV ডাউনলোড';
  });

  $('#rangeForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('#applyRangeBtn'); btn.setAttribute('aria-busy', 'true');
    await loadRange();
    btn.removeAttribute('aria-busy');
  });
  $('#csvBtn').addEventListener('click', downloadCSV);

  (async function init () {
    if (!SB.client) { $('#rangeHint').textContent = 'Supabase কনফিগার করা হয়নি'; return; }
    const { data: { session } } = await SB.client.auth.getSession();
    if (!session) { location.replace('login.html?next=admin-reports.html'); return; }
    const role = await SB.requireAdmin();
    if (role !== 'admin') { $('#gate403').hidden = false; return; }

    await loadSettings();
    $('#fromDate').value = todayISO();
    $('#toDate').value = todayISO();
    await loadRange();
    await loadDues();
  })();

  $('#signOutBtn').addEventListener('click', async () => {
    await SB.client.auth.signOut();
    location.href = 'login.html';
  });
})();
});
