/* সেবাঘর — reset page logic (extracted from reset.html inline <script>; DCL-guarded inside) */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
(function () {
  const { $, toast } = window.DG;
  const S = window.STRINGS.auth;
  SB.setupBanner();
  $('#resetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pass = $('#password');
    const ok = pass.value.length >= 8;
    pass.setAttribute('aria-invalid', ok ? 'false' : 'true');
    const err = pass.parentElement.querySelector('.field-error');
    if (err) err.classList.toggle('show', !ok);
    if (!ok || !SB.client) return;
    const btn = $('#resetBtn'); btn.setAttribute('aria-busy', 'true');
    // supabase-js picks up the recovery session from the URL hash automatically
    const { error } = await SB.client.auth.updateUser({ password: pass.value });
    btn.removeAttribute('aria-busy');
    if (error) { toast(S.loginFailed); return; }
    toast(S.resetDone);
    setTimeout(() => { location.href = 'login.html'; }, 1200);
  });
})();
});
