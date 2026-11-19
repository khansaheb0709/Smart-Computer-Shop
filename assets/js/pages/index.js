/* সেবাঘর — index page logic (extracted from index.html inline <script>; DCL-guarded inside) */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
(function () {
  const { $ } = window.DG;
  SB.setupBanner();

  // Shop info from settings (progressive enhancement — page works without it)
  (async function () {
    if (!SB.client) return;
    const { data: s } = await SB.client.from('shop_settings').select('shop_name, phone, opening_hours_bn, address_bn').eq('id', 1).single();
    if (!s) return;
    if (s.opening_hours_bn) $('#hoursText').textContent = s.opening_hours_bn;
    if (s.phone) {
      const digits = String(s.phone).replace(/\D/g, '');
      const intl = digits.startsWith('0') ? '880' + digits.slice(1) : digits;
      $('#callBtn').setAttribute('href', 'tel:' + digits);
      $('#waBtn').setAttribute('href', 'https://wa.me/' + intl + '?text=' + encodeURIComponent('আসসালামু আলাইকুম, সেবাঘর। আমি একটি সেবা সম্পর্কে জানতে চাই।'));
      $('#footPhone').textContent = digits;
      $('#footPhone').setAttribute('href', 'tel:' + digits);
      $('#callBtn').textContent = 'দোকানে কল করুন: ' + digits;
    }
  })();

  // Auth-aware account link
  (async function () {
    if (!SB.client) return;
    const { data: { session } } = await SB.client.auth.getSession();
    const a = $('#accountLink');
    if (session) { a.textContent = 'আমার অ্যাকাউন্ট'; a.href = 'account.html'; }
  })();
})();
});
