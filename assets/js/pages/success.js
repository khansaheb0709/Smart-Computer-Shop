/* সেবাঘর — success page logic (extracted from success.html inline <script>; DCL-guarded inside) */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
(function () {
  const { $, esc, fmtMoney, toBnDigits } = window.DG;
  let last = null;
  try { last = JSON.parse(sessionStorage.getItem('shebaghor.lastOrder') || 'null'); } catch (e) { last = null; }

  function bnToken(t) { return toBnDigits('টি-' + String(t).padStart(3, '0')); }

  if (!last) {
    $('#noHandoff').hidden = false;
    $('#tokenText').textContent = '✓';
    document.querySelectorAll('.card, #tokenText').forEach(el => { el.style.display = 'none'; });
    $('#waShareBtn').style.display = 'none';
    $('#printBtn').style.display = 'none';
    $('#tokenText').textContent = '✓';
    return;
  }

  const fmt = n => fmtMoney(n);
  $('#tokenText').textContent = bnToken(last.token);
  $('#successTotal').textContent = fmt(last.total);
  $('#successSummary').innerHTML = (last.items || []).map(it =>
    '<div class="row" style="justify-content:space-between; padding:4px 0; border-bottom:1px dotted var(--line)"><span>' + esc(it.name_bn) + '</span><span>' + esc(String(it.qty)) + ' × ' + fmt(it.unit_price) + '</span></div>'
  ).join('');
  $('#successMeta').textContent =
    (last.pickup_slot ? 'পিকআপ: ' + last.pickup_slot + ' • ' : '') +
    (last.payment_method === 'cash_on_pickup' ? 'পরিশোধ: দোকানে' : 'পরিশোধ: অগ্রিম (যাচাই বাকি)');

  const waText = encodeURIComponent('সেবাঘর — অর্ডার হয়েছে! টোকেন: ' + bnToken(last.token) + ', মোট: ' + fmt(last.total) + (last.payment_method !== 'cash_on_pickup' ? ' (অগ্রিম)' : '') + '। দোকানে গিয়ে এই টোকেন দেখিয়ে সংগ্রহ করুন।');
  $('#waShareBtn').href = 'https://wa.me/?text=' + waText;

  /* ---------- print sheet ---------- */
  const pItems = $('#pItems');
  pItems.innerHTML = (last.items || []).map(it =>
    '<tr><td>' + esc(it.name_bn) + '</td><td class="num">' + esc(String(it.qty)) + ' ' + esc(it.unit_bn) + '</td><td class="num">' + esc(String(Math.round(it.qty * it.unit_price))) + '</td></tr>'
  ).join('');
  $('#pToken').textContent = bnToken(last.token);
  $('#pTotal').textContent = fmt(last.total);
  $('#pPaid').textContent = last.payment_method === 'cash_on_pickup' ? '০' : String(last.total);
  $('#pDue').textContent = last.payment_method === 'cash_on_pickup' ? toBnDigits(String(last.total)) : '০';
  $('#pMeta').textContent = 'গ্রাহক: ' + (last.name || 'গেস্ট') + ' • ' + (last.phone || '') + ' • ' +
    new Date().toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' }) + (last.pickup_slot ? ' • পিকআপ: ' + last.pickup_slot : '');

  // Shop header/footer from settings (optional)
  (async function () {
    if (!SB.client) return;
    const { data: s } = await SB.client.from('shop_settings').select('shop_name, address_bn, phone, receipt_footer_bn').eq('id', 1).single();
    if (!s) return;
    $('#pShopName').textContent = s.shop_name || 'সেবাঘর';
    $('#pShopLine').textContent = s.address_bn || '';
    $('#pShopPhone').textContent = s.phone ? ('হটলাইন: ' + s.phone) : '';
    if (s.receipt_footer_bn) $('#pFoot').innerHTML = esc(s.receipt_footer_bn);
  })();

  $('#printBtn').addEventListener('click', () => window.print());
})();
});
