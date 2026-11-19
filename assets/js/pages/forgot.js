/* সেবাঘর — forgot page logic (extracted from forgot.html inline <script>; DCL-guarded inside) */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
(function () {
  const { $, toast } = window.DG;
  const S = window.STRINGS.auth;
  SB.setupBanner();
  $('#forgotForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#email');
    const val = email.value.trim();
    const ok = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(val);
    email.setAttribute('aria-invalid', ok ? 'false' : 'true');
    const err = $('.field-error'); if (err) err.classList.toggle('show', !ok);
    if (!ok || !SB.client) return;
    const btn = $('#forgotBtn'); btn.setAttribute('aria-busy', 'true');
    const redirectTo = location.origin + location.pathname.replace(/forgot\.html$/, '') + 'reset.html';
    const { error } = await SB.client.auth.resetPasswordForEmail(val, { redirectTo });
    btn.removeAttribute('aria-busy');
    if (error) { toast(S.loginFailed); return; }
    $('#forgotForm').hidden = true; $('#forgotSuccess').hidden = false;
  });
})();
});
