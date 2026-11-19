/* সেবাঘর — sw.js — PWA service worker
   Shell: cache-first. Navigations: network-first (fallback to cached index).
   Supabase REST/Storage: network-only — API responses may carry PII; never cached. */
'use strict';
const CACHE = 'shebaghor-v3'; // bump on every asset change so returning users drop stale caches
const SHELL = [
  './',
  'index.html',
  'services.html',
  'service.html',
  'order.html',
  'success.html',
  'track.html',
  'my-orders.html',
  'account.html',
  'login.html',
  'signup.html',
  'manifest.json',
  'assets/img/icon.svg',
  'assets/css/bundle.css',
  'assets/css/print.css',
  'assets/css/fonts.css',   // keep precached: source for future bundle rebuilds
  'assets/js/strings.js',
  'assets/js/dom.js',
  'assets/js/supabase.js',
  'assets/js/config.js',
  'assets/js/catalog.js',
  'assets/js/app-shell.js',
  'assets/js/pages/account.js',
  'assets/js/pages/admin-order.js',
  'assets/js/pages/admin-orders.js',
  'assets/js/pages/admin-reports.js',
  'assets/js/pages/admin-services.js',
  'assets/js/pages/admin.js',
  'assets/js/pages/forgot.js',
  'assets/js/pages/index.js',
  'assets/js/pages/login.js',
  'assets/js/pages/my-orders.js',
  'assets/js/pages/order.js',
  'assets/js/pages/reset.js',
  'assets/js/pages/service.js',
  'assets/js/pages/services.js',
  'assets/js/pages/signup.js',
  'assets/js/pages/success.js',
  'assets/js/pages/track.js',
  'jobs.html',
  'tools/index.html',
  'tools/passport-photo.html',
  'tools/document-scan.html',
  'tools/id-card.html',
  'tools/image-resize.html',
  'tools/qr-code.html',
  'tools/signature.html',
  'tools/calculator.html',
  'tools/cv.html',
  'tools/handwriting.html',
  'admin-jobs.html',
  'admin-work-queue.html',
  'admin-customers.html',
  'assets/css/tools.css',
  'assets/js/backup-build.js',
  'assets/js/docwarp.js',
  'assets/js/vendor-qrcode.js',
  'assets/js/vendor-jspdf.umd.min.js',
  'assets/js/vendor-tesseract.js',
  'assets/js/pages/jobs.js',
  'assets/js/pages/admin-jobs.js',
  'assets/js/pages/admin-work-queue.js',
  'assets/js/pages/admin-customers.js',
  'assets/js/pages/admin-drive.js',
  'assets/js/pages/tools-hub.js',
  'assets/js/pages/tools-passport-photo.js',
  'assets/js/pages/tools-document-scan.js',
  'assets/js/pages/tools-id-card.js',
  'assets/js/pages/tools-image-resize.js',
  'assets/js/pages/tools-qr-code.js',
  'assets/js/pages/tools-signature.js',
  'assets/js/pages/tools-calculator.js',
  'assets/js/pages/tools-cv.js',
  'assets/js/pages/tools-handwriting.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()) // a missing file must not brick install
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* Never cache Supabase (auth/REST/Storage may carry PII) */
  if (/supabase\.(co|in)$/.test(url.hostname) || url.hostname.endsWith('.supabase.co')) return;
  if (url.hostname !== self.location.hostname) return;

  const shellPaths = SHELL.map(p => new URL(p, self.registration.scope).pathname);

  /* Page navigations: network-first, fall back to cache, then index.html */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match(new URL('index.html', self.registration.scope).pathname)))
    );
    return;
  }

  /* Shell statics: cache-first */
  if (shellPaths.includes(url.pathname)) {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }))
    );
    return;
  }

  /* Everything else same-origin: network with cache fallback */
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok && url.pathname.startsWith(self.registration.scope)) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
