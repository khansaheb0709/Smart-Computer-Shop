# সেবাঘর (Shebaghor) — কম্পিউটার, ফটোকপি, প্রিন্টিং ও গ্রাফিক্স দোকান প্ল্যাটফর্ম

এই রিপোজিটরিতে **দুইটি অ্যাপ**, **৬টি আর্কিটেকচার ডকুমেন্ট** এবং একটি **Release Runbook** আছে।

## ১) সেবাঘর — কাস্টমার অ্যাপ (নতুন)
কাস্টমার অনলাইন থেকে সার্ভিস দেখে অর্ডার করবে (ফাইল আপলোড সহ), টোকেন দিয়ে ট্র্যাক করবে; দোকান এডমিন প্যানেল থেকে কিউ চালাবে, পেমেন্ট যাচাই করবে, রিসিট ছাপবে।

- **আর্কিটেকচার (প্রথমে পড়ুন):** [`docs/01_PRD.md` … `docs/06_Plan.md`](docs/) — AI কোডিং এজেন্টের (Claude Code / Cursor) জন্য ৬টি ডকুমেন্ট। লাইভ রিলিজের ধাপ-বাই-ধাপ: [`docs/07_Release_Runbook.md`](docs/07_Release_Runbook.md)। Drive ব্যাকআপ সেটআপ: [`docs/08_Google_Drive_Backup.md`](docs/08_Google_Drive_Backup.md)। ব্রিফিং: [`CLAUDE.md`](CLAUDE.md) · [`.cursorrules`](.cursorrules)
- **স্ট্যাক:** vanilla HTML/CSS/JS (build নেই) + Supabase (Postgres + RLS + Storage + Auth)। সব CSS/JS/ফন্ট **self-hosted** — external CDN কল নেই। হোস্টিং: **GitHub Pages** (বা Apps Script)। Google Drive শুধু ব্যাকআপ ভল্ট — HTML সেখানে রান হয় না।
- **DB স্কিমা:** [`supabase/schema.sql`](supabase/schema.sql) → [`supabase/policies.sql`](supabase/policies.sql) → [`supabase/seed.sql`](supabase/seed.sql) → টেস্ট [`supabase/tests.sql`](supabase/tests.sql)
- **ডিউপ্লি না, কাজ শুরু এখান থেকে:** `docs/06_Plan.md` এর **Phase 0** (P0-00 ✅ → P0-01…)।

### Supabase সেটআপ (একবার)
1. [supabase.com](https://supabase.com) → New project (নাম: যেকোনোটি; region: নিকটতম উপলব্ধ — বর্তমান prod: `ap-southeast-2`)।
2. SQL Editor → `schema.sql` → রান → `policies.sql` → রান → `seed.sql` → রান।
   ভেরিফাই: `select count(*) from services;` → **26**।
3. Storage → buckets বানাও: `order-files` (private, 10MB, pdf/jpg/png), `proofs` (private, 10MB), `shop-assets` (public, 5MB)। Storage policies: `policies.sql`-এর নিচের Storage অংশ রান করুন।
4. প্রথম ইউজার অ্যাকাউন্ট সাইনআপের পর: Dashboard → Authentication → Users → সেই ইউজার → Edit → `app_metadata` → `{ "role": "admin" }` সেট করুন।
5. `assets/js/config.js`-এ `SUPABASE_URL` ও `SUPABASE_ANON_KEY` বসান (শুধু anon key — service-role key কখনো নয়)।

### হোস্টিং (GitHub Pages)
রেপোর Settings → Pages → Source: `main` / `/ (root)`। কয়েক মিনিটে `https://<user>.github.io/<repo>/` লাইভ। কাস্টমার অ্যাপ: `/`, এডমিন: `/admin.html`।

## ২) দলিল সহায়ক (অভ্যন্তরীণ টুল — অফলাইন)
দলিল লেখকদের ঘরের ভেতরের টুল — সম্পূর্ণ **অফলাইন-ফার্স্ট**, এক ফাইল: `internal/index.html`। ৮ ধরনের দলিল, NID OCR, ভয়েস টাইপিং, দাগ-মাঠ মাপ হিসাব, হাত নকশা, সেবা কাউন্টার + টোকেন, সরকারি সেবা সহায়ক, CV, ছবি এডিট। কোনো সার্ভার লাগে না; ডেটা ব্রাউজারে; JSON ব্যাকআপ Drive-এ।
- বিস্তারিত: [`internal/README.md`](internal/README.md)
- `internal/`-এ `part*.html` ডেভ-ফ্র্যাগমেন্ট রাখা আছে; **`internal/index.html`-ই সার্ভ হয়**, এবং `cat part*.html` করলে index.html হুবহু পুনর্গঠিত হয় না (SETTINGS সেকশন অন্য অবস্থানে) — তাই `index.html` সরাসরি এডিট করুন এবং একই সম্পাদনা সংশ্লিষ্ট `part*.html`-এ মিরর করুন (যেমন `ba43558`-এ করা হয়েছে)।

## ব্যাকআপ (দুই অ্যাপেরই)
- দলিল সহায়ক: Settings → ব্যাকআপ → JSON ফাইল → Drive (মাসে অন্তত ১ বার)।
- সেবাঘর: admin → Settings → `সব ডেটা JSON ডাউনলোড` — সপ্তাহে একবার; Drive-এ আপলোড করুন। ব্যাকআপে orders/items/payments/order_events/order_files(মেটাডেটা)/profiles/proofs থাকে; ফাইলের আসল বাইট নয়। **Restore (ডিজস্টার):** ক্লিন প্রজেক্টে `schema.sql → policies.sql → seed.sql` চালু করার পর (seed-এর service id স্থির uuid5 — ব্যাকআপ লিঙ্ক টিকে থাকে):
  1. লোকাল Postgres: `sudo -u postgres psql -d shebaghor -v backup_file='/path/backup.json' -f tools/restore-backup.sql`
  2. বা hosted Supabase SQL editor: `python3 tools/backup-to-sql.py backup.json > restore.sql` → restore.sql পেস্ট → Run। (`pg_read_file` hosted-এ নেই — তাই এই দুটি পথ। দুটিই প্রি-ফ্লাইট ভ্যালিডেশন সহ — corrupt/অসম্পূর্ণ ব্যাকআপ হলে পরিষ্কার বার্তা দিয়ে বাতিল, আংশিক restore সম্ভব নয়; `service_id` অমিল হলে NULL (item-এর snapshot নাম/দাম থাকে)। একই প্রোজেক্টে রিস্টোর করলে সব FK লিঙ্ক অটুট; PG17-এ যাচাইকৃত।)
- ৬টি spec ডক + `07_Release_Runbook.md` ও এজেন্ট ব্রিফ Drive-এ মিরর করা আছে: ফোল্ডার **`সেবাঘর — Spec Docs`**।

## স্ট্যাটাস (২০২৬-১৬-১১)
- দলিল সহায়ক: কাজ করছে — `#view-counter`/`#view-report` খালি-রেন্ডারিং বাগ মেরামত (২০২৬-১১-১৬, `ba43558`): দূষিত localStorage-এ ইনিশিয়ালাইজ থেমে যেত; এখন প্রতিটি সেকশন-রেন্ডার আলাদা গার্ড, init সর্বদা `updateAll()` চালায় (try/finally), SW ক্যাশ বাম্প (`dolil-sohoyok-v2`)।
- সেবাঘর: **Phase 0 ✅ + Phase 1 ✅ + Phase 2 ✅ + Phase 3 ✅** আর **Phase 4 চলছে** — server-side hardening (qty ceiling, TrxID regex, tmp-path/mime/size/kind guards), RLS/tamper/timeout টেস্ট PG17-এ সবুজ, 4-admin সমসাময়িক রেস টেস্ট (১ জিতল, ৩ `invalid_transition`), self-hosted assets (fonts + supabase-js), CSP প্রতিটি পেজে (`script-src 'self'`), CSS bundle + deferred scripts, প্রিন্ট page-break fix, ট্যাপ টার্গেট ≥44px, `[hidden]` global fix। বাকি (HUMAN/Supabase দরকার): P4-09 `v1.0.0` tag (সব P4 আইটেম শেষ হওয়ার পর), P4-10 owner walkthrough; P4-02/P4-05/P4-06 লাইভ প্রজেক্টে চূড়ান্ত যাচাই। ব্লকার: Supabase প্রজেক্ট + anon key (P0-01..03), GitHub repo + Pages (P0-02/05/07) — `config.js`-এর প্লেসহোল্ডার ইচ্ছাকৃত খালি। **লাইভে যাওয়ার সম্পূর্ণ চেকলিস্ট: [`docs/07_Release_Runbook.md`](docs/07_Release_Runbook.md)।**
