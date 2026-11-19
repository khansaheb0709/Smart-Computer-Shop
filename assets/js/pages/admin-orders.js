/* সেবাঘর — admin-orders page logic (extracted from admin-orders.html inline <script>; DCL-guarded inside) */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
(function () {
  const { $, $$, esc, fmtMoney, toBnDigits, toast, normalizePhone } = window.DG;
  const S = window.STRINGS.status, Q = window.STRINGS.queue;
  const TABS = [
    ['new', Q.tabNew, o => ['placed', 'pending_verification'].includes(o.status)],
    ['active', Q.tabActive, o => ['confirmed', 'in_progress'].includes(o.status)],
    ['ready', Q.tabReady, o => o.status === 'ready'],
    ['due', Q.tabDue, o => (o.due || 0) > 0 && o.status !== 'cancelled'],
    ['all', Q.tabAll, () => true],
    ['cancelled', Q.tabCancelled, o => o.status === 'cancelled'],
  ];
  let activeTab = new URLSearchParams(location.search).get('tab') || 'new';
  let orders = [], profiles = {}, itemCounts = {};
  let pendingProofs = [];
  const proofsView = () => document.getElementById('proofsView');

  SB.setupBanner();

  function bnToken(t) { return toBnDigits('টি-' + String(t).padStart(3, '0')); }
  function waLink(phone, token) {
    const p = normalizePhone(phone || '');
    const intl = p.startsWith('0') ? '880' + p.slice(1) : p;
    const text = encodeURIComponent('সেবাঘর — আপনার অর্ডার ' + bnToken(token || '') + ' আপডেট হয়েছে। বিস্তারিতের জন্য দোকানে কল করুন বা ট্র্যাক লিংক ব্যবহার করুন।');
    return 'https://wa.me/' + intl + '?text=' + text;
  }
  function advanceLabel(o) {
    if (o.status === 'pending_verification') return null; // handled by payment box on detail page
    return Q.nextAdvance[o.status] || null;
  }

  async function load() {
    const list = $('#queueList');
    list.setAttribute('aria-busy', 'true');
    const { data, error } = await SB.client
      .from('orders')
      .select('id, order_date, token, status, total, paid, due, payment_method, payment_status, guest_name, guest_phone, customer_id, created_at, rework')
      .eq('order_date', new Date().toISOString().slice(0, 10))
      .order('token', { ascending: true });
    if (error) { toast(window.STRINGS.errors.generic); return; }
    orders = data || [];

    // batch-fetch customer profiles (admin can read all) + item counts
    const ids = [...new Set(orders.map(o => o.customer_id).filter(Boolean))];
    profiles = {};
    if (ids.length) {
      const { data: profs } = await SB.client.from('profiles').select('id, full_name, phone').in('id', ids);
      (profs || []).forEach(p => { profiles[p.id] = p; });
    }
    const orderIds = orders.map(o => o.id);
    itemCounts = {};
    if (orderIds.length) {
      const { data: items } = await SB.client.from('order_items').select('order_id, qty').in('order_id', orderIds);
      (items || []).forEach(it => { itemCounts[it.order_id] = (itemCounts[it.order_id] || 0) + Number(it.qty); });
    }
    await loadProofs();
    render();
  }

  async function loadProofs() {
    const { data: pf, error } = await SB.client.from('design_proofs')
      .select('id, order_id, round, sent_at, file_path')
      .eq('status', 'sent')
      .order('sent_at', { ascending: true });
    if (error) { pendingProofs = []; return; }
    const rows = pf || [];
    const orderIds = [...new Set(rows.map(p => p.order_id))];
    const ords = {};
    if (orderIds.length) {
      const { data: o } = await SB.client.from('orders')
        .select('id, order_date, token, guest_name, guest_phone, customer_id').in('id', orderIds);
      (o || []).forEach(x => { ords[x.id] = x; });
      const cids = [...new Set((o || []).map(x => x.customer_id).filter(Boolean))];
      if (cids.length) {
        const { data: profs } = await SB.client.from('profiles').select('id, full_name, phone').in('id', cids);
        (profs || []).forEach(p => { profiles[p.id] = p; });
      }
    }
    pendingProofs = await Promise.all(rows.map(async p => {
      const { data: signed } = await SB.client.storage.from('proofs')
        .createSignedUrl(String(p.file_path).replace(/^proofs\//, ''), 120);
      return { ...p, order: ords[p.order_id] || null, url: signed && signed.signedUrl ? signed.signedUrl : null };
    }));
  }

  function render() {
    const list = $('#queueList');
    const isProofs = activeTab === 'proofs';
    $('#tabChips').innerHTML = TABS.map(([key, label, fn]) => {
      const n = orders.filter(fn).length;
      return '<button class="chip' + (key === activeTab ? ' active' : '') + '" role="tab" data-tab="' + key + '">' + esc(label) + ' <span class="count">' + n + '</span></button>';
    }).join('') +
      '<button class="chip' + (isProofs ? ' active' : '') + '" role="tab" data-tab="proofs">' + esc(Q.tabProofs) + ' <span class="count">' + pendingProofs.length + '</span></button>';

    if (isProofs) { renderProofsView(); return; }
    proofsView().hidden = true;
    list.style.display = '';

    const tab = TABS.find(t => t[0] === activeTab) || TABS[0];
    const shown = orders.filter(tab[2]);
    $('#queueSummary').textContent = 'আজকের মোট ' + toBnDigits(orders.length) + 'টি অর্ডার • যাচাই বাকি ' +
      toBnDigits(orders.filter(o => o.status === 'pending_verification').length) + 'টি';
    $('#queueEmpty').hidden = shown.length > 0;
    list.setAttribute('aria-busy', 'false');

    list.innerHTML = shown.map(o => {
      const p = o.customer_id ? profiles[o.customer_id] : null;
      const name = o.guest_name || p?.full_name || 'গ্রাহক';
      const phone = o.guest_phone || p?.phone || '';
      const adv = advanceLabel(o);
      return '<div class="queue-card ' + esc(o.status) + '" data-id="' + esc(o.id) + '">' +
        '<div class="queue-token">' + bnToken(o.token) + '</div>' +
        '<div class="queue-info">' +
          '<div><strong>' + esc(name) + '</strong>' + (o.rework ? ' <span class="badge" data-status="cancelled" style="font-size:10px">রিওয়ার্ক</span>' : '') + '</div>' +
          '<div class="small muted">' + esc(phone) + ' • ' + toBnDigits(itemCounts[o.id] || 0) + ' আইটেম • ' + fmtMoney(o.total) + (o.due > 0 ? ' • বাকি ' + fmtMoney(o.due) : '') + '</div>' +
          '<div class="row" style="margin-top:4px"><span class="badge" data-status="' + esc(o.status) + '">' + esc(S[o.status] || o.status) + '</span>' +
            (o.payment_method !== 'cash_on_pickup' ? '<span class="badge" data-status="pending_verification" style="font-size:10px">অগ্রিম — ' + esc(o.payment_status) + '</span>' : '') + '</div>' +
        '</div>' +
        '<div class="row" style="flex-wrap:nowrap">' +
          (phone ? '<a class="icon-btn" href="tel:' + esc(normalizePhone(phone)) + '" aria-label="কল করুন"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 11.91a16 16 0 0 0 6 6l3.27-1.27a2 2 0 0 1 2.11.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg></a>' : '') +
          (phone ? '<a class="icon-btn" href="' + waLink(phone, o.token) + '" target="_blank" rel="noopener" aria-label="WhatsApp"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 6 8.38 8.38 0 0 1-3.8-.9L3 21l1.6-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 6-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></a>' : '') +
          '<a class="btn btn-ghost btn-small" href="admin-order.html?id=' + encodeURIComponent(o.id) + '">বিস্তার</a>' +
          (adv ? '<button class="btn btn-primary btn-small" data-advance="' + esc(o.id) + '" data-from="' + esc(o.status) + '">' + esc(adv) + '</button>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }

  function renderProofsView() {
    const pv = proofsView();
    $('#queueList').style.display = 'none';
    $('#queueEmpty').hidden = true;
    pv.hidden = false;
    $('#queueSummary').textContent = Q.proofsHint;
    if (!pendingProofs.length) {
      pv.innerHTML = '<div class="empty-state compact"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg><p>' + esc(Q.proofsEmpty) + '</p></div>';
      return;
    }
    pv.innerHTML = pendingProofs.map(p => {
      const o = p.order;
      const name = o ? (o.guest_name || (o.customer_id && profiles[o.customer_id]?.full_name) || 'গ্রাহক') : '—';
      const isPdf = p.file_path && /\.pdf$/i.test(p.file_path);
      const media = p.url
        ? (isPdf
            ? '<a class="btn btn-ghost btn-small" href="' + esc(p.url) + '" target="_blank" rel="noopener">PDF খুলুন</a>'
            : '<img src="' + esc(p.url) + '" alt="প্রমাণ রাউন্ড ' + esc(String(p.round)) + '" style="width:96px;height:72px;object-fit:cover;border-radius:8px;border:1px solid var(--border)" loading="lazy">')
        : '';
      return '<div class="queue-card" style="border-left-color:var(--amber)">' +
        '<div class="row" style="flex-wrap:nowrap">' + media + '</div>' +
        '<div class="queue-info">' +
          '<div><strong>' + esc(name) + '</strong> — রাউন্ড ' + esc(String(p.round)) + '</div>' +
          '<div class="small muted">' + (o ? bnToken(o.token) + ' • ' + esc(new Date(o.order_date).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' })) : '') +
            ' • পাঠানো ' + esc(new Date(p.sent_at).toLocaleString('bn-BD', { dateStyle: 'short', timeStyle: 'short' })) + '</div>' +
        '</div>' +
        '<div class="row" style="flex-wrap:nowrap">' + (o ? '<a class="btn btn-primary btn-small" href="admin-order.html?id=' + encodeURIComponent(o.id) + '">বিস্তার</a>' : '') + '</div>' +
      '</div>';
    }).join('');
  }

  async function advance(orderId, from, btn) {
    const map = { placed: 'confirmed', confirmed: 'in_progress', in_progress: 'ready', ready: 'completed' };
    const to = map[from];
    if (!to) return;
    btn.setAttribute('aria-busy', 'true');
    const { error } = await SB.client.rpc('advance_order_status', { p_order_id: orderId, p_to: to, p_note: null });
    btn.removeAttribute('aria-busy');
    if (error) {
      const msg = String(error.message || error);
      toast(msg.includes('invalid_transition') ? 'এই ধাপ বদল সম্ভব নয়' : window.STRINGS.errors.generic);
      return;
    }
    toast('আপডেট হয়েছে');
    await load();
  }

  (async function init () {
    if (!SB.client) { $('#queueSummary').textContent = 'Supabase কনফিগার করা হয়নি — docs/05_Schema.md দেখুন';
    $('#queueList').setAttribute('aria-busy','false'); return; }
    const { data: { session } } = await SB.client.auth.getSession();
    if (!session) { location.replace('login.html?next=admin-orders.html'); return; }
    const role = await SB.requireAdmin();
    if (role !== 'admin') { $('#gate403').hidden = false; document.querySelector('#main .admin-shell').style.display = 'none'; return; }
    await load();
    setInterval(() => { if (!document.hidden) load(); }, 10000);
  })();

  $('#tabChips').addEventListener('click', e => {
    const btn = e.target.closest('[data-tab]'); if (!btn) return;
    activeTab = btn.getAttribute('data-tab');
    history.replaceState(null, '', '?tab=' + activeTab);
    render();
  });
  $('#queueList').addEventListener('click', e => {
    const btn = e.target.closest('[data-advance]'); if (!btn) return;
    advance(btn.getAttribute('data-advance'), btn.getAttribute('data-from'), btn);
  });
  $('#refreshBtn').addEventListener('click', load);
  $('#signOutBtn').addEventListener('click', async () => {
    await SB.client.auth.signOut();
    location.href = 'login.html';
  });
})();
});
