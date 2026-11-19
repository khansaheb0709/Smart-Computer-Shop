/* সেবাঘর — admin-order page logic (extracted from admin-order.html inline <script>; DCL-guarded inside) */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
(function () {
  const { $, $$, esc, fmtMoney, toBnDigits, toast, normalizePhone } = window.DG;
  const S = window.STRINGS.status, Q = window.STRINGS.queue;
  const orderId = new URLSearchParams(location.search).get('id');

  SB.setupBanner();

  function bnToken(t) { return toBnDigits('টি-' + String(t).padStart(3, '0')); }
  function waIntl(phone) { const p = normalizePhone(phone || ''); return p.startsWith('0') ? '880' + p.slice(1) : p; }

  let order = null, items = [], payments = [], proofs = [], events = [];

  async function loadAll() {
    const [oRes, iRes, pRes, prRes, evRes] = await Promise.all([
      SB.client.from('orders').select('*').eq('id', orderId).maybeSingle(),
      SB.client.from('order_items').select('*').eq('order_id', orderId),
      SB.client.from('payments').select('*').eq('order_id', orderId).order('created_at', { ascending: true }),
      SB.client.from('design_proofs').select('*').eq('order_id', orderId).order('round', { ascending: true }),
      SB.client.from('order_events').select('*').eq('order_id', orderId).order('created_at', { ascending: true }),
    ]);
    if (oRes.error || !oRes.data) { $('#orderMeta').textContent = 'অর্ডার পাওয়া যায়নি।'; return; }
    order = oRes.data; items = iRes.data || []; payments = pRes.data || []; proofs = prRes.data || []; events = evRes.data || [];

    // customer profile (if logged in)
    let custName = order.guest_name, custPhone = order.guest_phone;
    if (order.customer_id) {
      const { data: p } = await SB.client.from('profiles').select('full_name, phone').eq('id', order.customer_id).maybeSingle();
      if (p) { custName = p.full_name; custPhone = p.phone; }
    }

    renderHeader(custName, custPhone);
    renderItems();
    renderCustomer(custName, custPhone);
    renderActions();
    renderPayment();
    renderFiles();
    renderProofs();
    renderEvents();
    fillPrintSheet(custName, custPhone);
  }

  function renderHeader(name, phone) {
    $('#orderToken').textContent = bnToken(order.token);
    const badge = $('#orderStatusBadge');
    badge.textContent = S[order.status] || order.status;
    badge.setAttribute('data-status', order.status);
    $('#orderMeta').textContent =
      new Date(order.order_date).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' }) +
      (order.pickup_slot ? ' • পিকআপ: ' + order.pickup_slot : '') +
      (order.rework ? ' • রিওয়ার্ক' : '');
  }

  function renderItems() {
    $('#itemsBody').innerHTML = items.map((it, i) =>
      '<tr id="itemRow-' + i + '"><td>' + esc(it.name_snapshot) + (it.options ? '<div class="small muted">' + esc(Object.entries(it.options).map(([k,v]) => k + ': ' + (typeof v === 'object' ? JSON.stringify(v) : v)).join(', ')) + '</div>' : '') + '</td>' +
      '<td>' + esc(String(it.qty)) + ' ' + esc(it.unit_snapshot) + '</td>' +
      '<td class="num">' + fmtMoney(it.unit_price) + '</td>' +
      '<td class="num">' + fmtMoney(it.line_total) + '</td>' +
      '<td><input type="checkbox" class="item-done" data-i="' + i + '" aria-label="সম্পন্ন" style="width:20px;height:20px;accent-color:var(--green-700)"></td></tr>'
    ).join('');
    $('#totalsTotal').textContent = fmtMoney(order.total);
    $('#totalsPaid').textContent = fmtMoney(order.paid);
    $('#totalsDue').textContent = fmtMoney(order.due);
    $('#orderNotes').textContent = order.notes ? 'নোট: ' + order.notes : '';
  }

  function renderCustomer(name, phone) {
    $('#customerName').textContent = name || '—';
    $('#customerPhone').textContent = phone || '—';
    $('#customerNote').textContent = order.payment_method === 'cash_on_pickup'
      ? 'দোকানে পরিশোধ করবে।' : 'অগ্রিম পেমেন্ট — ট্রানজেকশন মিলিয়ে যাচাই করুন।';
    $('#callBtn').href = phone ? 'tel:' + normalizePhone(phone) : '#';
    $('#waBtn').href = phone ? 'https://wa.me/' + waIntl(phone) : '#';
    $('#claimRow').hidden = !!order.customer_id;
  }

  function renderActions() {
    const map = { placed: ['কনফার্ম করুন', 'confirmed'], confirmed: ['কাজ শুরু করুন', 'in_progress'], in_progress: ['রেডি হয়েছে', 'ready'], ready: ['সম্পন্ন করুন', 'completed'] };
    const wrap = $('#actionButtons');
    let html = '';
    if (order.status === 'pending_verification') {
      html += '<span class="badge" data-status="pending_verification">পেমেন্ট যাচাইয়ের অপেক্ষায় — নিচের পেমেন্ট বক্স থেকে যাচাই/রিজেক্ট করুন</span>';
      $('#actionHint').textContent = '';
    } else if (map[order.status]) {
      const [label, to] = map[order.status];
      html += '<button class="btn btn-primary" id="advanceBtn" data-from="' + esc(order.status) + '" data-to="' + esc(to) + '">' + esc(label) + '</button>';
      $('#actionHint').textContent = 'কনফার্ম করার পর গ্রাহককে WhatsApp-এ জানান।';
    } else {
      $('#actionHint').textContent = order.status === 'cancelled' ? 'এই অর্ডার বাতিল হয়েছে।' : '';
    }
    if (!['cancelled', 'completed'].includes(order.status)) {
      html += '<button class="btn btn-ghost" id="showCancelBtn" type="button">বাতিল করুন</button>';
    }
    wrap.innerHTML = html;
    const rb = $('#reworkBtn');
    rb.textContent = order.rework ? 'রিওয়ার্ক সরান' : 'রিওয়ার্ক হিসেবে চিহ্নিত করুন';
    rb.classList.toggle('btn-danger', !!order.rework);
    rb.classList.toggle('btn-ghost', !order.rework);
    $('#notesInput').value = order.notes || '';
  }

  function renderPayment() {
    const body = $('#paymentBody');
    if (order.payment_method === 'cash_on_pickup') {
      body.innerHTML = '<p><span class="badge">দোকানে পরিশোধ</span></p><p class="small muted" style="margin-top:6px">মোট: ' + fmtMoney(order.total) + ' • জমা: ' + fmtMoney(order.paid) + ' • বাকি: ' + fmtMoney(order.due) + '</p>';
      return;
    }
    if (!payments.length) { body.innerHTML = '<p class="small muted">কোনো পেমেন্ট রেকর্ড নেই।</p>'; return; }
    body.innerHTML = payments.map(p => {
      let actions = '';
      if (p.status === 'pending') {
        actions = '<div class="row" style="margin-top:8px"><button class="btn btn-primary btn-small" data-verify="' + esc(p.id) + '">যাচাই হয়েছে ✓</button>' +
                  '<button class="btn btn-danger btn-small" data-reject="' + esc(p.id) + '">রিজেক্ট</button></div>';
      }
      return '<div style="border-bottom:1px dashed var(--line); padding:8px 0">' +
        '<div class="row"><strong>' + esc(String(p.method).toUpperCase()) + '</strong><span class="badge" data-status="' + (p.status === 'verified' ? 'confirmed' : 'pending_verification') + '">' + esc(p.status) + '</span></div>' +
        '<div class="small">পরিমাণ: ' + fmtMoney(p.amount) + '</div>' +
        (p.trx_id ? '<div class="small" style="font-family:Courier Prime,monospace">TrxID: ' + esc(p.trx_id) + '</div>' : '') +
        actions +
      '</div>';
    }).join('');
  }

  async function renderFiles() {
    const { data: files } = await SB.client.from('order_files')
      .select('id, file_path, original_name, mime, size_bytes, kind').eq('order_id', orderId);
    const box = $('#filesList');
    if (!files || !files.length) { box.innerHTML = '<p class="small muted">কোনো ফাইল আপলোড হয়নি।</p>'; return; }
    const links = await Promise.all(files.map(async f => {
      const path = String(f.file_path).replace(/^order-files\//, '');
      const { data: s } = await SB.client.storage.from('order-files').createSignedUrl(path, 120);
      return { f, url: s && s.signedUrl ? s.signedUrl : null };
    }));
    box.innerHTML = links.map(({ f, url }) =>
      '<div class="file-chip"><div class="meta"><div class="name">' + esc(f.original_name) + '</div>' +
      '<div class="small muted">' + esc(f.kind) + ' • ' + toBnDigits(Math.ceil((f.size_bytes || 0) / 1024)) + ' KB</div></div>' +
      (url ? '<a class="btn btn-ghost btn-small" href="' + esc(url) + '" target="_blank" rel="noopener" download="' + esc(f.original_name) + '">খুলুন</a>' : '') + '</div>'
    ).join('');
  }

  async function renderProofs() {
    const box = $('#proofsList');
    $('#nextRound').textContent = toBnDigits(proofs.length + 1);
    $('#roundChargeNote').hidden = (proofs.length + 1) <= 3;
    if (!proofs.length) { box.innerHTML = '<p class="small muted">এখনো কোনো প্রমাণ পাঠানো হয়নি।</p>'; return; }
    const items = await Promise.all(proofs.map(async p => {
      const path = String(p.file_path).replace(/^proofs\//, '');
      const { data: s } = await SB.client.storage.from('proofs').createSignedUrl(path, 120);
      return { p, url: s && s.signedUrl ? s.signedUrl : null };
    }));
    box.innerHTML = items.map(({ p, url }) =>
      '<div class="file-chip"><div class="meta"><div class="name">রাউন্ড ' + esc(String(p.round)) + ' — ' + esc(p.status) + (p.customer_note ? ' • ‘' + esc(p.customer_note) + '’' : '') + '</div></div>' +
      (url ? '<a class="btn btn-ghost btn-small" href="' + esc(url) + '" target="_blank" rel="noopener">খুলুন</a>' : '') + '</div>'
    ).join('');
  }

  function renderEvents() {
    const S2 = S;
    $('#eventsList').innerHTML = events.map(ev =>
      '<li>' + esc(new Date(ev.created_at).toLocaleString('bn-BD', { dateStyle: 'short', timeStyle: 'short' })) + ' — ' +
      esc((ev.from_status ? (S2[ev.from_status] || ev.from_status) + ' → ' : '') + (S2[ev.to_status] || ev.to_status)) +
      (ev.note ? ' <span class="muted">(' + esc(ev.note) + ')</span>' : '') + '</li>'
    ).join('');
  }

  async function fillPrintSheet(name, phone) {
    $('#pToken').textContent = bnToken(order.token);
    $('#pItems').innerHTML = items.map(it =>
      '<tr><td>' + esc(it.name_snapshot) + '</td><td class="num">' + esc(String(it.qty)) + ' ' + esc(it.unit_snapshot) + '</td><td class="num">' + esc(String(Math.round(it.qty * it.unit_price))) + '</td></tr>'
    ).join('');
    $('#pTotal').textContent = fmtMoney(order.total);
    $('#pPaid').textContent = toBnDigits(String(order.paid));
    $('#pDue').textContent = toBnDigits(String(order.due));
    $('#pMeta').textContent = 'গ্রাহক: ' + (name || '—') + ' • ' + (phone || '') + ' • ' +
      new Date(order.order_date).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' }) +
      (order.pickup_slot ? ' • পিকআপ: ' + order.pickup_slot : '');
    const { data: s } = await SB.client.from('shop_settings').select('shop_name, address_bn, phone, receipt_footer_bn').eq('id', 1).single();
    if (s) {
      $('#pShopName').textContent = s.shop_name || 'সেবাঘর';
      $('#pShopLine').textContent = s.address_bn || '';
      $('#pShopPhone').textContent = s.phone ? 'হটলাইন: ' + s.phone : '';
      if (s.receipt_footer_bn) $('#pFoot').innerHTML = esc(s.receipt_footer_bn);
    }
  }

  async function rpc(name, args) {
    const { error } = await SB.client.rpc(name, args);
    if (error) {
      const msg = String(error.message || error);
      if (msg.includes('invalid_transition')) toast('এই ধাপ বদল সম্ভব নয়');
      else if (msg.includes('forbidden')) toast('অনুমতি নেই');
      else toast(window.STRINGS.errors.generic);
      return false;
    }
    return true;
  }

  /* ---------- wire up ---------- */
  $('#actionButtons').addEventListener('click', async e => {
    const adv = e.target.closest('#advanceBtn');
    const showCancel = e.target.closest('#showCancelBtn');
    if (adv) {
      adv.setAttribute('aria-busy', 'true');
      const ok = await rpc('advance_order_status', { p_order_id: orderId, p_to: adv.dataset.to, p_note: null });
      adv.removeAttribute('aria-busy');
      if (ok) { toast('আপডেট হয়েছে'); await loadAll(); }
      return;
    }
    if (showCancel) { $('#cancelBox').hidden = false; $('#cancelReason').focus(); }
  });

  $('#confirmCancelBtn').addEventListener('click', async () => {
    const reason = $('#cancelReason').value.trim();
    if (!reason) { toast('বাতিলের কারণ লিখুন'); return; }
    const ok = await rpc('advance_order_status', { p_order_id: orderId, p_to: 'cancelled', p_note: reason });
    if (ok) { toast('অর্ডার বাতিল হয়েছে'); await loadAll(); }
  });

  $('#paymentBody').addEventListener('click', async e => {
    const verifyBtn = e.target.closest('[data-verify]');
    const rejectBtn = e.target.closest('[data-reject]');
    if (verifyBtn) {
      if (!confirm('পেমেন্ট যাচাই নিশ্চিত? অর্ডার কনফার্ম হয়ে যাবে।')) return;
      const ok = await rpc('set_payment_status', { p_payment_id: verifyBtn.dataset.verify, p_status: 'verified', p_note: null });
      if (ok) { toast('যাচাই হয়েছে ✓'); await loadAll(); }
      return;
    }
    if (rejectBtn) {
      const reason = prompt('রিজেক্টের কারণ লিখুন (গ্রাহক দেখবে):', 'TrxID মিলছে না');
      if (reason === null) return;
      const ok = await rpc('set_payment_status', { p_payment_id: rejectBtn.dataset.reject, p_status: 'rejected', p_note: reason.trim() || null });
      if (ok) { toast('পেমেন্ট রিজেক্ট হয়েছে'); await loadAll(); }
    }
  });

  $('#sendProofBtn').addEventListener('click', async () => {
    const input = $('#proofFile');
    const file = input.files && input.files[0];
    if (!file) { toast('ফাইল বেছে নিন'); return; }
    if (file.size > 10 * 1024 * 1024) { toast('ফাইল ১০MB-এর বেশি'); return; }
    const btn = $('#sendProofBtn');
    btn.setAttribute('aria-busy', 'true');
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    const round = proofs.length + 1;
    const path = 'proofs/' + orderId + '/' + crypto.randomUUID() + '.' + ext;
    const { data: { session } } = await SB.client.auth.getSession();
    const token = session && session.access_token ? session.access_token : window.SUPABASE_ANON_KEY;
    try {
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', window.SUPABASE_URL + '/storage/v1/object/' + path, true);
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.setRequestHeader('apikey', window.SUPABASE_ANON_KEY);
        xhr.setRequestHeader('x-upsert', 'false');
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error('upload_' + xhr.status));
        xhr.onerror = () => reject(new Error('network'));
        xhr.send(file);
      });
      const { error: insErr } = await SB.client.from('design_proofs').insert({
        order_id: orderId, round, file_path: path, status: 'sent',
      });
      if (insErr) throw insErr;
      toast('প্রমাণ পাঠানো হয়েছে');
      input.value = '';
      await loadAll();
    } catch (err) {
      console.error(err);
      toast('পাঠানো যায়নি — আবার চেষ্টা করুন');
    } finally {
      btn.removeAttribute('aria-busy');
    }
  });

  $('#itemsBody').addEventListener('change', e => {
    const cb = e.target.closest('.item-done'); if (!cb) return;
    const row = document.getElementById('itemRow-' + cb.dataset.i);
    if (row) row.style.opacity = cb.checked ? '0.45' : '';
  });

  $('#reworkBtn').addEventListener('click', async () => {
    const next = !order.rework;
    const { error } = await SB.client.from('orders').update({ rework: next }).eq('id', orderId);
    if (error) { toast(window.STRINGS.errors.generic); return; }
    order.rework = next;
    renderHeader(); renderActions();
    toast(next ? 'রিওয়ার্ক হিসেবে চিহ্নিত' : 'রিওয়ার্ক সরানো হয়েছে');
  });

  $('#saveNotesBtn').addEventListener('click', async () => {
    const txt = $('#notesInput').value.trim();
    const { error } = await SB.client.from('orders').update({ notes: txt || null }).eq('id', orderId);
    toast(error ? window.STRINGS.errors.generic : 'নোট সেভ হয়েছে');
    if (!error) order.notes = txt || null;
  });

  $('#claimBtn').addEventListener('click', async () => {
    const phone = normalizePhone(order.guest_phone || '');
    if (!phone) { toast('ফোন নম্বর নেই'); return; }
    const { data: p, error } = await SB.client.from('profiles').select('id, full_name, phone').eq('phone', phone).limit(1).maybeSingle();
    if (error || !p) { toast('এই নম্বরে কোনো অ্যাকাউন্ট পাওয়া যায়নি'); return; }
    if (!confirm(p.full_name + ' (' + p.phone + ')-কে যুক্ত করবেন?')) return;
    const { error: upErr } = await SB.client.from('orders').update({ customer_id: p.id }).eq('id', orderId);
    if (upErr) { toast(window.STRINGS.errors.generic); return; }
    toast('গ্রাহক যুক্ত হয়েছে — এখন থেকে অর্ডারটি /my-orders-এ দেখাবে');
    await loadAll();
  });

  $('#printBtn').addEventListener('click', () => window.print());
  $('#printBtn2').addEventListener('click', () => window.print());

  (async function init () {
    if (!orderId) { $('#orderMeta').textContent = 'অর্ডার আইডি নেই'; return; }
    if (!SB.client) { $('#gateEmpty').hidden = false; document.getElementById('orderHeaderRow').setAttribute('hidden',''); document.querySelectorAll('.card, .detail-layout').forEach(el => el.setAttribute('hidden','')); return; }
    const { data: { session } } = await SB.client.auth.getSession();
    if (!session) { location.replace('login.html?next=' + encodeURIComponent('admin-order.html?id=' + orderId)); return; }
    const role = await SB.requireAdmin();
    if (role !== 'admin') {
      $('#gate403').hidden = false;
      document.querySelectorAll('.card, .detail-layout').forEach(el => el.setAttribute('hidden',''));
      return;
    }
    await loadAll();
  })();

  $('#signOutBtn').addEventListener('click', async () => {
    await SB.client.auth.signOut();
    location.href = 'login.html';
  });
})();
});
