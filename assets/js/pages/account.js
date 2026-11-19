/* সেবাঘর — account page logic (extracted from account.html inline <script>; DCL-guarded inside) */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
(function () {
  const { $, toast, normalizePhone, PHONE_RE } = window.DG;
  const S = window.STRINGS.account;
  SB.setupBanner();

  (async function init () {
    if (!SB.client) return;
    const { data: { session } } = await SB.client.auth.getSession();
    if (!session) { location.replace('login.html?next=account.html'); return; }
    $('#accountEmail').textContent = session.user.email || '';
    const { data: profile, error } = await SB.client
      .from('profiles').select('full_name, phone, address, bn_digits').eq('id', session.user.id).single();
    if (error) { toast(S.saveFailed); return; }
    $('#full_name').value = profile?.full_name || '';
    $('#phone').value = profile?.phone || '';
    $('#address').value = profile?.address || '';
    $('#bn_digits').checked = profile?.bn_digits !== false;
  })();

  $('#accountForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!SB.client) return;
    const phoneEl = $('#phone');
    const p = normalizePhone(phoneEl.value);
    const phoneOk = !p || PHONE_RE.test(p);   // phone optional; if present must be valid
    phoneEl.setAttribute('aria-invalid', phoneOk ? 'false' : 'true');
    $('.field-error[data-for="phone"]').classList.toggle('show', !phoneOk);
    if (!phoneOk) return;
    const { data: { session } } = await SB.client.auth.getSession();
    if (!session) { location.replace('login.html?next=account.html'); return; }
    const btn = $('#saveBtn'); btn.setAttribute('aria-busy', 'true');
    const { error } = await SB.client.from('profiles').update({
      full_name: $('#full_name').value.trim() || null,
      phone: p || null,
      address: $('#address').value.trim() || null,
      bn_digits: $('#bn_digits').checked,
    }).eq('id', session.user.id);
    btn.removeAttribute('aria-busy');
    toast(error ? S.saveFailed : S.saved);
  });

  $('#signOutBtn').addEventListener('click', async () => {
    if (SB.client) await SB.client.auth.signOut();
    location.href = 'login.html';
  });
})();
});
