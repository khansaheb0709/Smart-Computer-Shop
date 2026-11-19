/* সেবাঘর — track page logic (extracted from track.html inline <script>; DCL-guarded inside) */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
(function () {
  const { $, $$, esc, toLatinDigits, toBnDigits, normalizePhone, toast } = window.DG;
  const S = window.STRINGS;
  SB.setupBanner();

  const STEPS = [
    ['placed', 'অর্ডার হয়েছে'],
    ['confirmed', 'কনফার্ম হয়েছে'],
    ['in_progress', 'কাজ চলছে'],
    ['ready', 'রেডি — কালেক্ট করুন'],
    ['completed', 'সম্পন্ন হয়েছে'],
  ];

  $('#trackForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = $('#trackError'); errEl.classList.remove('show');
    const tokenRaw = toLatinDigits($('#token').value).replace(/[^0-9]/g, '');
    const phone = normalizePhone($('#phone').value);
    const token = parseInt(tokenRaw, 10);
    if (!token || token <= 0 || !/^01[3-9][0-9]{8}$/.test(phone)) { errEl.classList.add('show'); return; }
    if (!SB.client) return;

    const btn = $('#trackBtn'); btn.setAttribute('aria-busy', 'true');
    const { data, error } = await SB.client.rpc('track_order', { p_token: token, p_phone: phone });
    btn.removeAttribute('aria-busy');
    if (error) { errEl.classList.add('show'); return; }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) { errEl.classList.add('show'); return; }

    const bnDigits = s => toBnDigits(s); // receipts/track show BN digits by default
    const statusIdx = STEPS.findIndex(([k]) => k === row.status);
    const events = Array.isArray(row.events) ? row.events : [];
    const at = to => {
      const ev = events.find(e => e.to === to);
      return ev ? new Date(ev.at).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' }) : '';
    };
    const itemsHtml = (Array.isArray(row.items) ? row.items : []).map(it =>
      '<tr><td>' + esc(it.name) + '</td><td class="num">' + esc(String(it.qty)) + '</td><td class="num">৳' + esc(String(it.total)) + '</td></tr>'
    ).join('');

    $('#trackResult').innerHTML =
      '<div class="track-meta">' +
        '<div><div class="micro">টোকেন</div><div style="font-size:20px;font-weight:800;color:var(--green-800)">' + bnDigits('টি-' + String(row.token).padStart(3, '0')) + '</div></div>' +
        '<div><div class="micro">মোট</div><div style="font-size:20px;font-weight:800">৳' + bnDigits(row.total) + '</div></div>' +
        '<div><div class="micro">বাকি</div><div style="font-size:20px;font-weight:800;color:' + (row.due > 0 ? 'var(--danger)' : 'var(--ok)') + '">৳' + bnDigits(row.due) + '</div></div>' +
      '</div>' +
      '<ul class="timeline">' + STEPS.map(([key, label], i) => {
        const done = statusIdx >= i;
        const time = at(key);
        return '<li class="' + (done ? 'done' : '') + '"><span class="dot' + (done ? ' done' : '') + '"></span><span><strong>' + esc(label) + '</strong>' + (time ? '<br><span class="small muted">' + esc(time) + '</span>' : '') + '</span></li>';
      }).join('') + '</ul>' +
      (itemsHtml ? '<div class="table-wrap" style="margin-top:16px"><table class="table"><thead><tr><th>আইটেম</th><th>পরিমাণ</th><th>মোট</th></tr></thead><tbody>' + itemsHtml + '</tbody></table></div>' : '') +
      (row.pickup_slot ? '<p class="small muted" style="margin-top:12px">পিকআপ: ' + esc(row.pickup_slot) + '</p>' : '');
    $('#trackResult').hidden = false;
  });
})();
});
