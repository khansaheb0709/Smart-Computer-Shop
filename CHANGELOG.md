# Changelog

সেবাঘর-এর সব উল্লেখযোগ্য পরিবর্তন এখানে নথিভুক্ত। ফরম্যাট: [Keep a Changelog](https://keepachangelog.com/)-অনুপ্রাণিত; তারিখ `YYYY-MM-DD`।

## [1.1.0] — Unreleased (Phase 5 — টুলকিট, জব বোর্ড, Drive ব্যাকআপ; লাইভ প্রিভিউ যাচাই বাকি)

### Added
- `tools/` — ১১টি সম্পূর্ণ ক্লায়েন্ট-সাইড টুল (কোনো আপলোড নেই, Bengali UI, CSP-সেফ self-hosted asset): পাসপোর্ট ছবি (retouch, ব্যাকগ্রাউন্ড বদল, A4 শিট), ডকুমেন্ট A4 স্ক্যান (perspective warp + flat-field ছায়া দূর, রঙিন/সাদাকালো/B&W, A4 প্রিন্ট, jsPDF-এ PDF), আইডি কার্ড (সামনে+পিছন → CR80 A4 শিট), ছবি রিসাইজ (KB-লক্ষ্যে JPEG কম্প্রেশন), QR মেকার (লিংক/tel:/wa.me/UPI), ডিজিটাল সিগনেচার (transparent PNG), ক্যালকুলেটর + দোকান হিসাব (ছাড়/ভ্যাট/বাকি), CV বিল্ডার (১০ ডিজাইন, বাংলা-ইংরেজি, .doc+প্রিন্ট), হাতের লেখা→ওয়ার্ড OCR (Tesseract.js 5.1.1, ben+eng self-hosted model, `wasm-unsafe-eval` কেবল ঐ পেজে, accuracy সতর্কবার্তাসহ)।
- জব বোর্ড (`jobs.html`, সার্বিক দৃশ্যমান) — দোকান-হোস্টেড বিজ্ঞপ্তি বোর্ড; আবেদন WhatsApp deep-link-এ; কোনো seeker অ্যাকাউন্ট নেই। Admin CRUD: `admin-jobs.html`। DB: `job_posts` (RLS: active-select প্রকাশ্য, বাকি admin)।
- ওয়ার্ক কিউ / কাজের বোর্ড (`admin-work-queue.html`) — ৫ অবস্থা, অগ্রাধিকার, due date (লাল=অতিবাহিত), দিনের টোকেন→order লিংক। DB: `work_tasks` (RLS admin-only)।
- কাস্টমার লিস্ট + ফাইল লাইব্রেরি (`admin-customers.html`) — ফোন/নাম সার্চ, এক দৃষ্টিতে সব কাজ, অর্ডার ফাইল ও প্রুফ signed-URL দিয়ে ডাউনলোড।
- Google Drive ব্যাকআপ/রিস্টোর (`admin.html` → ডেটা ব্যবস্থাপনা) — GIS token client, `drive.appdata` scope, appDataFolder-এ multipart আপলোড; রিস্টোর ইচ্ছাকৃতভাবে ডাউনলোড-অনলি; Console সেটআপ `docs/08_Google_Drive_Backup.md`।
- ক্যাটালগে ৯টি ফ্রি টুল সেবা (`tool-*` slugs, ৳০, যাচাই: Smart Shop-এ ৩৫টি active সেবা)।
- `sw.js` v3 precache; `assets/js/docwarp.js` (ভাগ homography/bilinear), `backup-build.js` (শেয়ার্ড ব্যাকআপ বিল্ডার)।
- `internal/index.html`-এ `noindex,nofollow` (offline fallback হিসেবে অটুট)।

### Changed
- admin.html CSP-তে কেবল `accounts.google.com`/`www.googleapis.com` (script/connect/frame); অন্য পেজ অচ্ছুত। handwriting পেজে `wasm-unsafe-eval` + `worker-src blob:`।
- admin JSON backup কোড `backup-build.js`-এ এক্সট্র্যাক্ট (ডুপ্লিকেশন নেই)।

### Known limits (সৎ তালিকা)
- বাস্তব ব্রাউজারে ক্লিক-থ্রু এখনো হয়নি (এই এনভায়রনমেন্টে ব্রাউজার নেই) — Android/owner ওয়ালথ্রু দরকার। OCR প্রথম রানে ~১২MB মডেল ডাউনলোড।
- ফ্রি ৳০ ক্যাটালগ এন্ট্রি অর্ডার-কার্টে ৳০ আইটেম যোগ করতে পারে — দরকার হলে `active=false` বা দাম দিন।
- Drive "রিস্টোর" ফাইল ডাউনলোড পর্যন্ত; DB রিস্টোর SQL-হাতেই (জাহাজ ক্ষতি এড়াতে)।
- `job_posts`/`work_tasks` JSON ব্যাকআপ v2-তে নেই (PII-ন্যূনতম — চয়েস ডকুমেন্টেড, 05_Schema §10)।

## [1.0.0] — Unreleased (hosted রিলিজের অপেক্ষা — `docs/07_Release_Runbook.md` অনুসরণ করুন)

প্রথম পাবলিক রিলিজ। কোড, টেস্ট ও ডকুমেন্ট প্রস্তুত; বাকি কাজ সব HUMAN/credentials ধাপ (P0-01..07, P4-02, P4-05, P4-10) — রানবুক ধাপ 1–10।

### Phase 0 — Foundation & DB (P0-04 যাচাইকৃত PG17, 2026-11-15, `1874adc`)
- Supabase schema + RLS (৯ টেবিল + ৮ storage policy) + seed (২৬ সেবা, স্থির uuid5 id) + PG17 টেস্ট-স্যুট (A1–A9)।
- অভ্যন্তরীণ টুল দলিল সহায়ক `internal/`-এ (অফলাইন-ফার্স্ট ওয়ান-ফাইল অ্যাপ)।

### Phase 1 — Auth, tokens, admin gate (2026-11-16, `499b7b8`)
- vanilla JS shell, Bengali-first UI, auth (signup/login/forgot/reset), `is_admin()` (JWT app_metadata অথবা profiles), অর্ডার-ট্র্যাক শেল, সেটআপ ব্যানার।

### Phase 2 — Order core & admin ops (2026-11-16, `df2cdaf`)
- ক্যাটালগ + অনুসন্ধান/ফিল্টার/জনপ্রিয়তা (`service_popularity()`), সেবা-বিস্তারিত সহ live price।
- ৪-ধাপের অর্ডার wizard (draft autosave, XHR upload w/ progress + retry), সার্ভার-সাইড মূল্য হিসাব (`create_order` — ক্লায়েন্ট-টোটাল অগ্রাহ্য)।
- success/track/my-orders (proof অনুমোদন, reorder), admin কিউ + বিস্তার (advance/verify/reject, rework, guest-claim), A5 রসিদ, bKash TrxID regex `^[A-Z0-9]{8,12}$` + mismatch → auto-cancel।

### Phase 3 — Reports, proofs, catalog admin, PWA (2026-11-16, `dd9ca91`)
- admin-reports (summary/dues), শীর্ষ-৫ বার, CSV (BOM + লাতিন ডিজিট); admin-services CRUD + ক্রম; proofs→sent বোর্ড + round>3 চার্জ ব্যানার; ৩০-দিনের NID-purge (storage DELETE policy সহ)।
- JSON backup export (সহজ রিস্টোরের জন্য ৭ টেবিল, v2 ফরম্যাট), অফলাইন ব্যানার, 404.html, PWA (manifest + sw v2, ≤2KB shell ক্যাশ) — Supabase রেসপন্স **কখনো ক্যাশ নয়** (PII)।
- A11y=100 (দুইবার), ট্যাপ টার্গেট ≥44px, focus-visible রিং।

### Phase 4 — Hardening & recovery (2026-11-16, `7661309`…`0dfe494`)
- Tamper/সীমা টেস্ট D0–D6; RLS role-simulation E1–E11 + F1 (PG17); 4-অ্যাডমিন রেস টেস্ট (১ জিতল, ৩ `invalid_transition`); মধ্যরাত টোকেন সীমানা; CSP সব পেজে (`default-src 'self'`); self-hosted ফন্ট + supabase-js (CDN নেই); CSS bundle; প্রিন্ট page-break; দুটো restore path (SQL editor + psql) প্রি-ফ্লাইট ভ্যালিডেশন সহ — corrupt ব্যাকআপ partial-restore করতে পারে না; internal দলিল সহায়কের blank-view বাগ মেরামত (`ba43558`)।

### Docs
- `docs/01_PRD.md`…`06_Plan.md` (স্পেক), `docs/07_Release_Runbook.md` (hosted রিলিজ চেকলিস্ট), কমিট-ট্রেসযোগ্য পরিবর্তন-লগ এই ফাইলে।

### Known limits (সৎ তালিকা)
- বাস্তব Supabase-এ লাইভ ক্লিক-থ্রু এখনো হয়নি (P0-07-এর পরে); Perf শেষযাচাই বাস্তব Android-এ (sandbox simulate 84/devtools-throttle 99)।
- ফ্রি টায়ার সীমা: 500MB DB / 1GB Storage — সাপ্তাহিক JSON ব্যাকআপ Drive-এ রাখুন।
- Payment gateway নেই (ইচ্ছাকৃত ডিজাইন); বিকাশ TrxID হাতে মিলিয়ে verify হয় (admin চালানে)।
- IE বাদ (per plan); iOS Safari সূচক-চেক HUMAN ধাপ 8-এ।

