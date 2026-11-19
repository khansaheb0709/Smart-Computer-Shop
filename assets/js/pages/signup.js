/* সেবাঘর — signup page logic (extracted from signup.html inline <script>; DCL-guarded inside) */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
(function () {
  const { $, toast, normalizePhone, PHONE_RE } = window.DG;
  const S = window.STRINGS.auth;
  SB.setupBanner();

  const showFieldError = (input, on) => {
    input.setAttribute('aria-invalid', on ? 'true' : 'false');
    const err = $('.field-error[data-for="' + input.name + '"]');
    if (err) err.classList.toggle('show', on);
  };

  $('#signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#full_name'), phone = $('#phone'), email = $('#email'), pass = $('#password');
    const p = normalizePhone(phone.value);
    const okName = name.value.trim().length >= 2;
    const okPhone = PHONE_RE.test(p);
    const okEmail = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email.value.trim());
    const okPass = pass.value.length >= 8;
    showFieldError(name, !okName); showFieldError(phone, !okPhone);
    showFieldError(email, !okEmail); showFieldError(pass, !okPass);
    if (!(okName && okPhone && okEmail && okPass) || !SB.client) return;

    const btn = $('#signupBtn');
    btn.setAttribute('aria-busy', 'true');
    const { error } = await SB.client.auth.signUp({
      email: email.value.trim(),
      password: pass.value,
      options: { data: { full_name: name.value.trim(), phone: p } },
    });
    btn.removeAttribute('aria-busy');
    if (error) { toast(S.signupFailed); return; }
    $('#signupForm').hidden = true;
    $('#signupSuccess').hidden = false;
  });
})();
});
