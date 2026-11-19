/* সেবাঘর — order page logic (extracted from order.html inline <script>; DCL-guarded inside) */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
(function () {
  const { $, $$, esc, fmtMoney, normalizePhone, PHONE_RE, toast } = window.DG;
  const S = window.STRINGS.order;
  const C = window.CATALOG;
  let cfg = window.SHEBAGHOR_CONFIG || {};
  let draft = C.getDraft();
  let session = null, profile = null, uploading = 0;

  SB.setupBanner();

  /* ---------- step navigation ---------- */
  const steps = [1, 2, 3, 4];
  function go(n) {
    steps.forEach(i => {
      $('#step' + i).hidden = (i !== n);
      const dot = $('.wizard-step[data-step="' + i + '"]');
      dot.classList.toggle('active', i === n);
      dot.classList.toggle('done', i < n);
    });
    document.getElementById('main').scrollIntoView({ block: 'start' });
    location.hash = 'step' + n;
    if (n === 4) renderReview();
  }
  const initial = (location.hash.match(/step([1-4])/) || [])[1];
  if (initial) setTimeout(() => go(+initial), 0);

  /* ---------- STEP 1 ---------- */
  function mergedOptions(o) {
    const entries = Object.entries(o || {}).filter(([, v]) => v);
    return entries.length ? entries.map(([k, v]) => esc(k) + ': ' + esc(v)).join(', ') : '';
  }
  function renderStep1() {
    draft = C.getDraft();
    const list = $('#draftList');
    $('#draftEmpty').hidden = draft.items.length > 0;
    list.innerHTML = draft.items.map((it, idx) => {
      const line = Math.round(it.qty * it.unit_price);
      return '<div class="draft-item" data-idx="' + idx + '">' +
        '<div style="min-width:0; flex:1"><strong>' + esc(it.name_bn) + '</strong>' +
          (mergedOptions(it.options) ? '<div class="small muted">' + mergedOptions(it.options) + '</div>' : '') +
          '<div class="small muted">' + fmtMoney(it.unit_price) + ' / ' + esc(it.unit_bn) + '</div></div>' +
        '<div class="row" style="flex-wrap:nowrap">' +
          '<div class="qty-stepper">' +
            '<button type="button" class="icon-btn" data-act="dec" aria-label="কমান">−</button>' +
            '<input class="control" type="number" inputmode="numeric" min="1" max="9999" value="' + it.qty + '" aria-label="পরিমাণ">' +
            '<button type="button" class="icon-btn" data-act="inc" aria-label="বাড়ান">+</button>' +
          '</div>' +
          '<div style="min-width:76px; text-align:right"><strong>' + fmtMoney(line) + '</strong></div>' +
          '<button type="button" class="icon-btn" data-act="remove" aria-label="মুছুন"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
        '</div></div>';
    }).join('');
    $('#draftTotal').textContent = fmtMoney(C.draftTotal(draft));
    $('#toStep2').disabled = draft.items.length === 0;
  }
  $('#draftList').addEventListener('click', e => {
    const row = e.target.closest('.draft-item'); if (!row) return;
    const idx = +row.getAttribute('data-idx');
    const act = e.target.closest('[data-act]')?.getAttribute('data-act');
    if (act === 'inc') draft.items[idx].qty = Math.min(9999, draft.items[idx].qty + 1);
    else if (act === 'dec') draft.items[idx].qty = Math.max(1, draft.items[idx].qty - 1);
    else if (act === 'remove') draft.items.splice(idx, 1);
    else return;
    C.saveDraft(draft); renderStep1();
  });
  $('#draftList').addEventListener('change', e => {
    const row = e.target.closest('.draft-item'); if (!row || e.target.tagName !== 'INPUT') return;
    const idx = +row.getAttribute('data-idx');
    draft.items[idx].qty = Math.max(1, Math.min(9999, parseInt(e.target.value, 10) || 1));
    C.saveDraft(draft); renderStep1();
  });

  /* ---------- STEP 2 — files ---------- */
  const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png'];
  const MAX_BYTES = 10 * 1024 * 1024, MAX_FILES = 10;
  const dz = $('#dropzone'), fileInput = $('#fileInput'), fileList = $('#fileList');

  function requiresFileNow() { return C.getDraft().items.some(it => it.requires_file); }
  function uploadedCount() { return C.getDraft().files.length; }

  function renderFileRequirement() {
    $('#fileRequirement').textContent = requiresFileNow()
      ? 'আপনার নির্বাচিত সেবা(গুলো)র জন্য ফাইল আপলোড বাধ্যতামূলক'
      : 'ফাইল লাগলে এখানে আপলোড করুন; না লাগলে সরাসরি পরের ধাপে যান';
    $('#toStep3').disabled = requiresFileNow() && uploadedCount() === 0;
  }
  function renderFiles() {
    draft = C.getDraft();
    fileList.innerHTML = draft.files.map((f, idx) =>
      '<div class="file-chip" data-idx="' + idx + '">' +
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--green-700)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
        '<div class="meta"><div class="name" title="' + esc(f.original_name) + '">' + esc(f.original_name) + '</div>' +
        '<div class="small muted">' + Math.round(f.size_bytes / 1024) + ' KB</div></div>' +
        '<button type="button" class="icon-btn" data-act="remove-file" aria-label="ফাইল মুছুন"><svg viewBox="0 0 24 24"><polyline points="18 6 6 18"/><polyline points="6 6 18 18"/></svg></button>' +
      '</div>'
    ).join('');
    renderFileRequirement();
  }
  function addFileChipPending(file) {
    const el = document.createElement('div');
    el.className = 'file-chip';
    el.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>' +
      '<div class="meta"><div class="name">' + esc(file.name) + '</div><div class="file-progress"><div style="width:0%"></div></div></div>';
    fileList.prepend(el);
    return el;
  }
  function uuid() { return (crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(16) + Math.random().toString(16).slice(2))); }
  function safeName(n) { return n.replace(/[^\w.\-]+/g, '_').slice(0, 80); }

  let retryFiles = [];

  async function uploadOne(file) {
    const draftNow = C.getDraft();
    if (draftNow.files.length >= MAX_FILES) { toast('সর্বোচ্চ ' + MAX_FILES + 'টি ফাইল'); return; }
    if (!ALLOWED.includes(file.type)) { toast('শুধু PDF/JPG/PNG ফাইল'); return; }
    if (file.size > MAX_BYTES) { toast('ফাইল ১০MB-এর বেশি'); return; }
    const chip = addFileChipPending(file);
    const bar = chip.querySelector('.file-progress > div');
    uploading++;

    const objectPath = 'tmp/' + uuid() + '-' + safeName(file.name);
    const bearer = (session && session.access_token) || cfg.SUPABASE_ANON_KEY;
    const url = String(cfg.SUPABASE_URL).replace(/\/$/, '') + '/storage/v1/object/order-files/' + objectPath;
    try {
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.setRequestHeader('Authorization', 'Bearer ' + bearer);
        xhr.setRequestHeader('apikey', cfg.SUPABASE_ANON_KEY);
        xhr.setRequestHeader('x-upsert', 'false');
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.upload.onprogress = e => { if (e.lengthComputable && bar) bar.style.width = Math.round(e.loaded / e.total * 100) + '%'; };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error('http-' + xhr.status + ' ' + xhr.responseText.slice(0, 160)));
        xhr.onerror = () => reject(new Error('network'));
        xhr.send(file);
      });
      const d = C.getDraft();
      d.files.push({ file_path: 'order-files/' + objectPath, kind: 'source', size_bytes: file.size, mime: file.type, original_name: safeName(file.name) });
      C.saveDraft(d);
      chip.remove();
      renderFiles();
    } catch (err) {
      console.error('upload failed', err);
      const ridx = retryFiles.push(file) - 1;
      chip.querySelector('.meta').innerHTML =
        '<div class="name" style="color:var(--danger)">' + esc(file.name) + '</div>' +
        '<div class="small" style="color:var(--danger)">আপলোড হয়নি</div>' +
        '<button class="btn btn-ghost btn-small" data-retry="' + ridx + '" style="margin-top:4px">আবার চেষ্টা করুন</button>';
      const prog = chip.querySelector('.file-progress'); if (prog) prog.remove();
      toast(S.uploadFailed);
    } finally { uploading--; renderFileRequirement(); }
  }
  function handleFiles(list) { [...list].forEach(uploadOne); }
  dz.addEventListener('click', () => fileInput.click());
  dz.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
  fileInput.addEventListener('change', e => { handleFiles(e.target.files); fileInput.value = ''; });
  ['dragenter', 'dragover'].forEach(evt => dz.addEventListener(evt, e => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(evt => dz.addEventListener(evt, e => { e.preventDefault(); dz.classList.remove('drag'); }));
  dz.addEventListener('drop', e => { if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files); });
  fileList.addEventListener('click', e => {
    const retry = e.target.closest('[data-retry]');
    if (retry) {
      const f = retryFiles[Number(retry.getAttribute('data-retry'))];
      retry.closest('.file-chip').remove();
      if (f) uploadOne(f);
      return;
    }
    const btn = e.target.closest('[data-act="remove-file"]'); if (!btn) return;
    const idx = +btn.closest('.file-chip').getAttribute('data-idx');
    const d = C.getDraft(); d.files.splice(idx, 1); C.saveDraft(d); renderFiles();
  });

  /* ---------- STEP 3 ---------- */
  async function initSession() {
    if (!SB.client) return;
    const { data } = await SB.client.auth.getSession();
    session = data.session;
    if (session) {
      $('#loggedInBox').hidden = false; $('#guestBox').hidden = true;
      const { data: p } = await SB.client.from('profiles').select('full_name, phone').eq('id', session.user.id).single();
      profile = p || null;
      $('#li_name').value = profile?.full_name || '';
      $('#li_phone').value = profile?.phone || '';
    } else {
      $('#loggedInBox').hidden = true; $('#guestBox').hidden = false;
    }
  }
  function readCustomer() {
    if (session) return { name: ($('#li_name').value || '').trim(), phone: normalizePhone($('#li_phone').value) };
    return { name: $('#g_name').value.trim(), phone: normalizePhone($('#g_phone').value) };
  }
  function validateGuest() {
    if (session) {
      const ok = PHONE_RE.test($('#li_phone').value ? normalizePhone($('#li_phone').value) : '') || !$('#li_phone').value;
      return ok;
    }
    const nameOk = $('#g_name').value.trim().length >= 2;
    const phoneOk = PHONE_RE.test(normalizePhone($('#g_phone').value));
    $('#g_name').setAttribute('aria-invalid', nameOk ? 'false' : 'true');
    $('#g_phone').setAttribute('aria-invalid', phoneOk ? 'false' : 'true');
    $('.field-error[data-for="g_name"]')?.classList.toggle('show', !nameOk);
    $('.field-error[data-for="g_phone"]')?.classList.toggle('show', !phoneOk);
    return nameOk && phoneOk;
  }

  /* ---------- STEP 4 ---------- */
  async function loadPickupSlots() {
    const sel = $('#pickup_slot');
    let slots = ['আজ সন্ধ্যা ৬–৮টা', 'আগামীকাল সকাল', 'আগামীকাল দুপুর'];
    if (SB.client) {
      const { data: s } = await SB.client.from('shop_settings').select('pickup_slots').eq('id', 1).single();
      if (s && Array.isArray(s.pickup_slots) && s.pickup_slots.length) slots = s.pickup_slots;
    }
    sel.innerHTML = slots.map(s => '<option value="' + esc(s) + '">' + esc(s) + '</option>').join('');
  }
  function renderReview() {
    draft = C.getDraft();
    $('#reviewTable tbody').innerHTML = draft.items.map(it =>
      '<tr><td>' + esc(it.name_bn) + (mergedOptions(it.options) ? '<br><span class="small muted">' + mergedOptions(it.options) + '</span>' : '') + '</td><td>' + esc(String(it.qty)) + ' ' + esc(it.unit_bn) + '</td><td class="num">' + fmtMoney(Math.round(it.qty * it.unit_price)) + '</td></tr>'
    ).join('');
    $('#reviewTotal').textContent = fmtMoney(C.draftTotal(draft));
  }
  $('#payOptions').addEventListener('change', () => {
    const val = ($('input[name="payment_method"]:checked') || {}).value;
    $('#trxBox').hidden = (val === 'cash_on_pickup');
    $$('.pay-option').forEach(el => el.classList.toggle('selected', el.contains($('input[name="payment_method"]:checked'))));
  });

  $('#submitOrderBtn').addEventListener('click', async () => {
    draft = C.getDraft();
    if (!draft.items.length) { toast(S.errEmpty); go(1); return; }
    if (uploading > 0) { toast('ফাইল আপলোড শেষ হওয়া পর্যন্ত অপেক্ষা করুন'); return; }
    const { name, phone } = readCustomer();
    if (!validateGuest()) { go(3); toast(S.errGuestInfo); return; }
    const payment_method = ($('input[name="payment_method"]:checked') || {}).value || 'cash_on_pickup';
    const trxRaw = ($('#trx_id').value || '').trim().toUpperCase();
    const trxOk = payment_method === 'cash_on_pickup' || /^[A-Z0-9]{8,12}$/.test(trxRaw);
    $('#trx_id').setAttribute('aria-invalid', trxOk ? 'false' : 'true');
    $('.field-error[data-for="trx_id"]')?.classList.toggle('show', !trxOk);
    if (!trxOk) { toast(S.errTrx); return; }

    const btn = $('#submitOrderBtn');
    btn.setAttribute('aria-busy', 'true');
    try {
      // sanitize draft quantities (defense against tampered localStorage)
      for (const it of draft.items) {
        it.qty = Math.max(1, Math.min(9999, Math.round(Number(it.qty) || 1)));
      }
      const { data, error } = await SB.client.rpc('create_order', {
        p_items: draft.items.map(it => ({ service_id: it.service_id, qty: it.qty, options: it.options || {} })),
        p_customer: { name, phone, notes: $('#order_notes').value.trim() || null, pickup_slot: $('#pickup_slot').value, payment_method },
        p_trx_id: payment_method === 'cash_on_pickup' ? null : trxRaw,
        p_files: draft.files,
      });
      if (error) {
        const msg = String(error.message || error);
        if (msg.includes('guest_info_required')) { go(3); toast(S.errGuestInfo); }
        else if (msg.includes('empty_order')) { go(1); toast(S.errEmpty); }
        else if (msg.includes('qty_invalid')) { go(1); toast('পরিমাণ ঠিক করুন (১–৯৯৯৯)'); }
        else if (msg.includes('trx_invalid')) { go(4); toast(S.errTrx); }
        else if (msg.includes('files_invalid')) { go(2); toast('ফাইলের তথ্য ঠিক নেই — আবার আপলোড করুন'); }
        else if (msg.includes('service_unavailable')) { go(1); toast('একটি সেবা এখন আর পাওয়া যাচ্ছে না — লিস্ট রিফ্রেশ করুন'); }
        else toast(S.errNetwork);
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      sessionStorage.setItem('shebaghor.lastOrder', JSON.stringify({
        token: row.token, total: row.total, order_id: row.order_id,
        items: draft.items, payment_method, pickup_slot: $('#pickup_slot').value,
        phone, name, notes: $('#order_notes').value.trim(),
      }));
      C.clearDraft();
      location.href = 'success.html';
    } catch (err) {
      console.error(err);
      toast(S.errNetwork);
    } finally {
      btn.removeAttribute('aria-busy');
    }
  });

  /* ---------- boot ---------- */
  $('#toStep2').addEventListener('click', () => go(2));
  $('#toStep3').addEventListener('click', () => go(3));
  $('#toStep4').addEventListener('click', () => { if (validateGuest()) go(4); });
  $('#backTo1').addEventListener('click', () => go(1));
  $('#backTo2').addEventListener('click', () => go(2));
  $('#backTo3').addEventListener('click', () => go(3));

  renderStep1();
  renderFiles();
  initSession().then(() => {
    loadPickupSlots();
  });
})();
});
