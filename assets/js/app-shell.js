/* সেবাঘর — app-shell.js — PWA install chip + offline banner + SW registration (customer app) */
'use strict';
(function () {
  /* ---- Service worker (skip file:// and non-http) ---- */
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () { /* SW optional */ });
    });
  }

  /* ---- Offline banner ---- */
  var banner = null;
  function ensureBanner() {
    if (banner) return banner;
    banner = document.createElement('div');
    banner.setAttribute('role', 'status');
    banner.style.cssText = 'position:fixed; left:12px; right:12px; bottom:calc(12px + env(safe-area-inset-bottom)); z-index:9999;' +
      'background:#7c2d12; color:#fde68a; font:600 13px/1.5 "Noto Sans Bengali",sans-serif;' +
      'padding:10px 14px; border-radius:12px; box-shadow:0 6px 24px rgba(0,0,0,.25); text-align:center; display:none;';
    banner.textContent = 'ইন্টারনেট সংযোগ নেই — কিছুক্ষণ পর আবার চেষ্টা করুন';
    document.body.appendChild(banner);
    return banner;
  }
  function showBanner() { ensureBanner().style.display = 'block'; }
  function hideBanner() { if (banner) banner.style.display = 'none'; }
  window.addEventListener('offline', showBanner);
  window.addEventListener('online', hideBanner);
  if (navigator.onLine === false) document.addEventListener('DOMContentLoaded', showBanner);

  /* ---- Install prompt (Android Chrome) ---- */
  var deferredPrompt = null, chip = null;
  function ensureChip() {
    if (chip) return chip;
    chip = document.createElement('button');
    chip.type = 'button';
    chip.textContent = '📲 হোম স্ক্রিনে যোগ করুন';
    chip.style.cssText = 'position:fixed; right:12px; bottom:calc(64px + env(safe-area-inset-bottom)); z-index:9998;' +
      'background:#0d3b2e; color:#ffe9a8; border:none; font:700 13px "Noto Sans Bengali",sans-serif;' +
      'min-height:44px; padding:10px 16px; border-radius:999px; box-shadow:0 6px 20px rgba(0,0,0,.25); cursor:pointer;';
    chip.addEventListener('click', function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () {
        deferredPrompt = null;
        chip.remove(); chip = null;
      });
    });
    document.body.appendChild(chip);
    return chip;
  }
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    ensureChip();
  });
  window.addEventListener('appinstalled', function () {
    if (chip) { chip.remove(); chip = null; }
    deferredPrompt = null;
  });
})();
