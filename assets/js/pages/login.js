/* সেবাঘর — login page logic (extracted from login.html inline <script>; DCL-guarded inside) */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
(function () {
  const { $, toast, normalizePhone } = window.DG;
  const S = window.STRINGS.auth;
  const params = new URLSearchParams(location.search);
  const next = params.get('next') || 'index.html';
  SB.setupBanner();

  function showFieldError(input, on) {
    input.setAttribute('aria-invalid', on ? 'true' : 'false');
    const err = $('.field-error[data-for="' + input.name + '"]');
    if (err) err.classList.toggle('show', on);
  }

  // Magic link — works even before password is set
  $('#magicBtn').addEventListener('click', async () => {
    const email = $('#email');
    const val = email.value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(val)) { showFieldError(email, true); return; }
    showFieldError(email, false);
    if (!SB.client) return;
    const { error } = await SB.client.auth.signInWithOtp({ email: val, options: { emailRedirectTo: location.origin + location.pathname.replace(/login\.html$/, '') + next } });
    toast(error ? (S.loginFailed) : S.magicSent);
  });

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#email'), pass = $('#password');
    const okEmail = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email.value.trim());
    const okPass = pass.value.length >= 8;
    showFieldError(email, !okEmail); showFieldError(pass, !okPass);
    if (!okEmail || !okPass || !SB.client) return;
    const btn = $('#loginBtn');
    btn.setAttribute('aria-busy', 'true');
    const { error } = await SB.client.auth.signInWithPassword({ email: email.value.trim(), password: pass.value });
    btn.removeAttribute('aria-busy');
    if (error) { toast(S.loginFailed); return; }
    location.href = next;
  });
})();
});
