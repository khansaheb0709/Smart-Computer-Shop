# 04 — Technical Requirements Document (TRD)
**Product:** সেবাঘর (Shebaghor) · **Version:** 1.0 · **Date:** 2026-11-13
Philosophy: **zero build step, zero framework, zero monthly cost** — a static web page that must survive Google Apps Script / GitHub Pages / any dumb static host, with a real Postgres behind it.

---

## 1. Locked tech stack (do not substitute without doc review)
| Layer | Locked choice | Version / pin | Why |
|---|---|---|---|
| Markup | HTML5 (static, multi-page or single `index.html` + hash routes) | — | Works on any static host incl. Apps Script `HtmlService` |
| Styling | Hand-written CSS3 + custom properties | — | No preprocessor needed; see 03_UI_Spec |
| Logic | Vanilla ES2020 JavaScript (classic scripts or ES modules) | ES2020 | No transpile; runs everywhere |
| DB / Auth / Storage / Realtime | **Supabase** (hosted Postgres + GoTrue + Storage) | `@supabase/supabase-js@2` — self-hosted at `assets/js/vendor-supabase.min.js` (UMD global `supabase`); no CDN | Free tier; RLS; no server to run |
| Auth methods | Email + password; magic link; password reset | Supabase Auth built-in | Phone OTP skipped (SMS cost) — see Non-Goals |
| File storage | Supabase Storage buckets (`order-files` private, `proofs` private, `shop-assets` public) | — | Signed URLs, 10MB limit, mime whitelist |
| Payments | None (cash / bKash / Nagad **manual TrxID**) | — | No merchant API in MVP |
| Notifications | `wa.me` deep links (prefilled text) | — | Free, works on customer phones |
| Printing | Browser print + `@page` CSS (A5 receipt; A4 deeds via internal tool) | — | Free, no POS printer SDK |
| PWA | `manifest.json` + `sw.js` (cache-first shell) | SW API | Install to Android home screen; offline shell |
| OCR (internal tool only) | Tesseract.js | `tesseract.js@5` CDN | NID auto-fill in দলিল সহায়ক |
| Icons | Inline SVG (Lucide-style paths) | — | No icon font |
| Fonts | Noto Serif Bengali + Noto Sans Bengali — self-hosted woff2 subsets at `assets/fonts/` + `assets/css/fonts.css` (`font-display: optional`); system fallback always | OFL license | Bengali-first; zero external font requests |
| Hosting | **GitHub Pages** (recommended) or **Google Apps Script Web App** (Google ecosystem), **Google Drive = backup vault only** | — | See §7 — Drive cannot execute HTML |
| Version control | Git + GitHub repo (`shebaghor`) | — | History, rollback, Pages deploy |
| Analytics | None in MVP (privacy + simplicity) | — | Admin reports give business metrics |

**Explicitly rejected:** React/Vue/Next (build step + hosting friction), Firebase (RLS weaker, lock-in), custom Node/Express server (ops burden, cost), MongoDB (relations matter here), WhatsApp Business API (paid), payment gateway SDKs.

## 2. Repository / folder structure
```
shebaghor/  (this repo root)
├── docs/                      # 01..06 (this context) — agents MUST read first
├── CLAUDE.md                  # agent instructions (root)
├── .cursorrules               # Cursor agent instructions (root)
├── README.md                  # human quickstart: hosting, Supabase setup, deploy
├── index.html                 # customer app shell (all customer routes, hash-based)
├── admin.html                 # admin dashboard shell (same design system, is_admin gated)
├── manifest.json              # PWA manifest (customer app)
├── sw.js                      # service worker (cache-first shell; network-only for API)
├── assets/
│   ├── css/   tokens.css, base.css, components.css, app.css, shop.css, auth.css, print.css,
│   │          fonts.css (self-hosted @font-face), bundle.css (GENERATED — tools/bundle-css.sh; pages link ONLY this)
│   ├── js/    vendor-supabase.min.js (self-hosted supabase-js v2), strings.js, config.js (public anon key ONLY),
│   │          dom.js, supabase.js, app-shell.js, catalog.js,
│   │          pages/<page>.js (per-page logic; no inline <script> anywhere)
│   ├── img/   logo.svg, icon.svg
│   └── fonts/ notosans-*.woff2, notoserif-*.woff2 (Noto Bengali, OFL, self-hosted 2026-11)
├── supabase/
│   ├── schema.sql             # tables, enums, indexes, triggers, RPCs
│   ├── policies.sql           # RLS enable + all policies (idempotent)
│   ├── seed.sql               # 26 services w/ current shop prices (see 05_Schema §8)
│   └── tests.sql              # RLS leak tests (pgTAP-style plain asserts)
└── internal/                  # দলিল সহায়ক — existing single-file internal tool (unchanged behavior)
    └── index.html

> **Repo layout migration (do in Phase 0, step P0-00):** this repo currently contains the internal tool at its root (`index.html`, `part*.html`, `sw.js`, `manifest.json`, `icon.svg`). Before building the customer app, `git mv` those into `/internal/` untouched (behavior preserved); `docs/`, `CLAUDE.md`, `.cursorrules` stay at root; a fresh `README.md` describes the customer platform.
```
Runtime config (`assets/js/config.js`): `SUPABASE_URL`, `SUPABASE_ANON_KEY` only — these two are public by design; security lives in RLS. **The service-role key is never in this repo.**

## 3. Third-party APIs & SDKs (complete list)
| Service | Use | Auth | Cost |
|---|---|---|---|
| Supabase Postgres | data, RPC | anon key + RLS | free tier |
| Supabase Auth | signup/login/reset | built-in | free tier (50k MAU) |
| Supabase Storage | order files, proofs, shop assets | signed URLs | 1GB free |
| Tesseract.js (internal tool only) | NID OCR | none | free |
| wa.me | customer notifications (manual send) | none | free |
| Google Maps search URL | "দোকানে আসুন" link | none | free |
| bKash/Nagad apps | payment by customer; TrxID verify in admin | owner's own app | n/a |
| GitHub Pages | static hosting | repo token | free |
| Google Apps Script | optional host | Google account | free |
| Google Drive | backup JSON vault (manual upload) | Google account | free |
| Tesseract.js (internal) | NID OCR | none | free |

No other network calls permitted. The customer app makes **zero external CDN requests** — supabase-js, Noto subsets and all CSS/JS are self-hosted (P4-05 hardening, 2026-11). Tesseract.js is the only CDN dependency, and it belongs to `internal/` only.

## 4. Security constraints (hard rules)
1. **RLS enabled on every table.** No table ships without policies. `supabase/policies.sql` is part of CI-ish manual checklist.
2. **`anon` key only** in client. Service-role key lives in Supabase dashboard → SQL editor / Edge Functions only.
3. **Prices computed server-side** inside `create_order()` RPC from `services` table. Client-supplied prices ignored entirely — tamper-proof by construction.
4. **Guest tracking** via security-definer RPC `track_order(token, phone)` returning minimal non-sensitive fields (status timeline, totals) — never raw rows; rate-limit via simple per-session counter + optional pg extension later.
5. **File uploads**: bucket mime whitelist (`application/pdf,image/jpeg,image/png`), size ≤10MB, path `order-files/tmp/<uuid>-<safe_name>` (ownership attached inside `create_order()` via `p_files`; clients never INSERT `order_files`); private bucket; downloads via 60-second signed URLs; customers can read only files on their own orders.
6. **NID/personal docs**: stored under order; purge-able by admin ("30-day purge" button); never logged; never in URL query strings.
7. **XSS**: all DB/user strings rendered via `textContent` or escaped (`esc()`); no `innerHTML` with unsanitized input; CSP meta: `default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co; font-src https://fonts.gstatic.com`.
8. **Auth hygiene**: passwords ≥ 8 chars; reset via email; admin flag in `app_metadata.role='admin'` set manually in dashboard (not self-assignable); `is_admin()` reads JWT only.
9. **Injection**: RPCs validate enum inputs; numeric bounds enforced (qty 1–10000, discount 0..total); no dynamic SQL with user input.
10. **Enumeration resistance**: tokens are sequential daily but phone required to track; order IDs are UUIDs (not exposed in URLs except admin).
11. **Transport**: HTTPS only (Pages/Apps Script force it); no mixed content.
12. **Secrets in repo**: forbidden; `.gitignore` includes `config.local.js`; pre-commit manual check.

## 5. Performance budgets
- Customer home TTI ≤ 2.5s on Fast 3G (≤ 250KB initial transfer, fonts subset).
- Lighthouse (mobile): ≥ 90 Performance / ≥ 95 Accessibility / ≥ 100 SEO on home.
- Catalog ≤ 60 services → single query, indexed; no client pagination needed.
- Images: WebP ≤ 150KB each; lazy-load below fold.

## 6. Browser & device support
Chrome/Edge/Firefox/Safari last 2 versions; Android 9+ WebView; iOS 14+ Safari; Windows 8.1+ (shop PC, may be old — avoid optional chaining in hot paths if targeting IE… no: IE11 explicitly unsupported, use ES2020 freely).

## 7. Hosting — Google Drive reality check (important)
Google Drive **stores** files but does not execute HTML/JS as a website; Drive links either download or show a sandboxed preview. Therefore:
- **Recommended:** GitHub Pages (`https://<user>.github.io/shebaghor/`) — free, HTTPS, custom domain optional.
- **Google-ecosystem option:** Google Apps Script → New Apps Script project → paste `index.html` as `index.html` + `Code.gs` with `doGet()` → Deploy as Web app. Runs under Google's domain; `localStorage` works per-origin; Supabase calls must be plain `fetch` (supabase-js UMD via CDN also works inside Apps Script HTML).
- **Drive's role:** store `backup-YYYY-MM-DD.json` exports (admin → Export) and design assets. Nothing user-facing is served from Drive directly.
- Internal tool (দলিল সহায়ক) remains a standalone single file usable double-clicked, from Drive download, or Pages.

## 8. Environment & config
| Var | Where | Example |
|---|---|---|
| `SUPABASE_URL` | `assets/js/config.js` | `https://abcd1234.supabase.co` |
| `SUPABASE_ANON_KEY` | same | `eyJhbGciOi...` (public) |
| `ADMIN_EMAILS` (bootstrap only) | Supabase dashboard | `owner@example.com` |
| bKash/Nagad display numbers | DB table `shop_settings` | `017XX-XXXXXX (বিকাশ, পার্সোনাল)` |

Switching Supabase projects = edit `config.js` only. DB schema is code (`schema.sql`) in this repo — reproducible.

## 9. Testing strategy (pre-deploy checklist, see 06_Plan Phase 4)
Manual test matrix on real Android Chrome: order happy path (cash + prepaid), guest tracking, all admin transitions incl. invalid ones (must fail), RLS leak checks with two browsers (customer A cannot read B's orders/files — verify via REST in devtools), price tamper test, upload mime/size rejects, print receipt on A5, CSV open in Excel, offline banner, PWA install, backup/restore drill. `supabase/tests.sql` asserts RLS denies cross-user reads.

## 10. Observability & support
No third-party telemetry. Admin → Settings → "সমস্যা রিপোর্ট কপি" produces JSON (browser, version, last 20 console errors, current user id/role, app version) to paste into WhatsApp support. Supabase dashboard provides DB logs. Backup: weekly Export JSON → Drive (reminder banner in admin if >7 days).
