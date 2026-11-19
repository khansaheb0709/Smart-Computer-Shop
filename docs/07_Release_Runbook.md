# সেবাঘর — Release Runbook (v1.0.0)

**কাদের জন্য:** যে কেউ (মালিক/ডেভেলপার) প্রথমবার সেবাঘরকে লাইভে নিচ্ছেন। কোড, টেস্ট ও ডকুমেন্ট সব প্রস্তুত; এই রানবুক **শুধু বাকি মানুষের হাতে করা কাজগুলো**-র স্টেপ-বাই-স্টেপ চেকলিস্ট।
**সময়:** ≈ ৬০–৯০ মিনিট। **পূর্বশর্ত:** GitHub + Supabase অ্যাকাউন্ট, দোকানের নাম/ফোন/ঠিকানা, bKash মার্চেন্ট নম্বর (যদি অগ্রিম নেওয়া হয়)।
**যে ডক পড়ে আগেভাগে জানা ভালো:** `docs/01_PRD.md` (কী বানাচ্ছি), `docs/05_Schema.md` (DB/RLS), `docs/06_Plan.md` (কাজের অগ্রগতি — সব লেবেল (HUMAN)/(TEST) এখানেই ম্যাপ করা)।

---

## ধাপ 0 — আপনার কাছে কী কী আছে যাচাই করুন
- [ ] এই রিপোজিটরির লোকাল কপি পরিষ্কার: `cd /home/user/dolil-app && git status` → `nothing to commit`।
- [ ] টেস্ট-স্যুট (ঐচ্ছিক, 5 মিনিট): `sudo -n -u postgres psql -d shebaghor_test -v ON_ERROR_STOP=1 -f - < supabase/tests.sql` → সব assert পার।
- [ ] Supabase ফ্রি টায়ারের সীমা মনে রাখুন: 500MB DB / 1GB Storage / 50k MAU / 2 সক্রিয় প্রজেক্ট।

## ধাপ 1 — GitHub রেপো + Pages (P0-01, P0-07)
1. github.com → New repository → নাম `shebaghor` → Public → **কোনো** README/license যোগ করবেন না।
2. লোকালে:
   ```bash
   cd /home/user/dolil-app
   git branch -M main                      # Pages-র "main" কনভেনশনের সাথে মিলিয়ে
   git remote add origin https://github.com/<আপনার-ইউজারনেম>/shebaghor.git
   git push -u origin main
   ```
3. রেপো → Settings → Pages → Source: **Deploy from a branch** → Branch: **main** → Folder: **/ (root)** → Save।
   (কাস্টম 404 আগে থেকেই আছে — `404.html`।)
4. push-এর সাথে সাথে **CI (`.github/workflows/ci.yml`)** চলবে — PG17 স্যুট (schema→policies→seed→tests, `services=26`) + সব JS syntax চেক + manifest/icon যাচাই। রেপো → Actions ট্যাবে **সবুজ ✓** দেখা চাই; লাল হলে merge/revert করুন।
5. ১–২ মিনিট পর `https://<ইউজারনেম>.github.io/shebaghor/` খুলুন — কাস্টমার হোম পেজ দেখা যাবে।
   - এখনো config খালি ⇒ "সেটআপ ব্যানার" + খালি ক্যাটালগ — এটা স্বাভাবিক (ধাপ 2-এ ঠিক হবে)।
5. `…/admin.html` খুলুন — ৪০৩/সেটআপ অবস্থা দেখাবে।

## ধাপ 2 — Supabase প্রজেক্ট + স্কিমা (P0-02, P0-03)
1. supabase.com → New project → (বর্তমান prod: মালিকের `Smart Shop`, region `ap-southeast-2` — মালিকের সিদ্ধান্ত; Mumbai নিতে চাইলে নতুন project এবং ধাপ 2 পুনরায়) — database password কোথাও নিরাপদে লেখুন। **2026-11-16-এ prod সম্পূর্ণ provisioned** (schema+policies+seed+3 buckets; drill প্রজেক্ট `shebaghor-drill` আলাদা, ap-south-1)।
2. SQL Editor → নতুন query → ফাইলের পুরো কনটেন্ট পেস্ট → Run:
   1. `supabase/schema.sql`
   2. `supabase/policies.sql` (টেবিল RLS + 8 storage policy — দুটোই এই ফাইলে)
   3. `supabase/seed.sql` (26 সেবা; service id স্থির uuid5)
3. যাচাই (SQL Editor-এ):
   ```sql
   select count(*) from services;        -- → 26
   select public.is_admin();             -- → false (স্বাভাবিক; ধাপ 3-এ admin হবে)
   ```
4. Storage → ৩টি bucket:
   | Bucket | Public? | Max | Mime |
   |---|---|---|---|
   | `order-files` | private | 10MB | application/pdf, image/jpeg, image/png |
   | `proofs` | private | 10MB | image/jpeg, image/png, image/webp, application/pdf |
   | `shop-assets` | public | 5MB | image/jpeg, image/png, image/webp, image/svg+xml |
   (Bucket-এ file size limit ও allowed mime — Dashboard → Storage → bucket → Configuration।)
5. Project Settings → Data API → **Project URL** ও **anon public key** কপি → লোকালে `assets/js/config.js`-এ বসান:
   ```js
   window.SHEBAGHOR_CONFIG = { SUPABASE_URL: 'https://<ref>.supabase.co', SUPABASE_ANON_KEY: 'eyJ…' };
   ```
   > anon key **পাবলিক-সেফ** (RLS ডেটা রক্ষা করে) — কমিট করে push করুন। **service_role key কখনো config.js-এ নয়, কখনো কমিটে নয়।**
6. `git add assets/js/config.js && git commit -m "config: supabase URL + anon key (public-safe)" && git push` — Pages নিজে রিডিপ্লয় করবে (~১ মিনিট)।

## ধাপ 3 — প্রথম admin (P0-06)
1. `https://<ইউজারনেম>.github.io/shebaghor/signup.html` → মালিকের **আসল ইমেইল** দিয়ে সাইন আপ → ইমেইল ভেরিফাই।
2. Supabase Dashboard → Authentication → Users → সেই ইউজার → **Edit** → `app_metadata` →
   ```json
   { "role": "admin" }
   ```
   (অথবা SQL: `update public.profiles set is_admin = true where id = '<uid>';` — `is_admin()` JWT app_metadata **অথবা** profiles.is_admin — যেকোনো একটি যথেষ্ট।)
3. sign out → আবার sign in → `…/admin.html` খুলুন — সেটিংস ড্যাশবোর্ড লোড হওয়া উচিত।
4. admin → Settings → দোকানের নাম/ফোন/ঠিকানা/bKash নম্বর → সংরক্ষণ।

## ধাপ 4 — Live smoke test (৫ মিনিট, কাস্টমার+এডমিন)
- [ ] ইনকগনিটো উইন্ডো → হোম → সেবা বেছে নিন → অর্ডার (guest, নিজের ফোন) → ২টি ফাইল আপলোড → টোকেন পান।
- [ ] `track.html`-এ টোকেন+ফোন → টাইমলাইন দেখায়।
- [ ] admin → নতুন অর্ডার ট্যাব → অর্ডার দেখা যাচ্ছে → **পরবর্তী ধাপ** × ৩ → রেডি।
- [ ] TrxID দিয়ে বিকাশ অর্ডার টেস্ট: `success.html`-এ TrxID দিন → admin-এ verify → auto-advance `confirmed`। ভুল TrxID → **reject → অর্ডার auto-cancel** (এটাই ডিজাইন)।
- [ ] A5 রসিদ প্রিন্ট (admin-order → রসিদ প্রিন্ট) — বাস্তব প্রিন্টার/PDF-এ পৃষ্ঠা-বিভাজন ঠিক আছে কি না।
- [ ] my-orders (একই ফোন-নম্বরের অ্যাকাউন্ট) → proof approve/changes — যদি প্রুফ-লুপ টেস্ট করতে চান।

## ধাপ 5 — Hosted restore drill — THROWAWAY প্রজেক্টে (P4-06-এর HUMAN অংশ)
> ⚠️ **কখনো লাইভ/প্রোডাকশন প্রজেক্টে wipe-restore চালাবেন না।** আলাদা ফ্রি টেস্ট প্রজেক্ট ব্যবহার করুন।
1. supabase.com → New project `shebaghor-restore-test` (ap-south-1) → ধাপ 2-এর schema/policies/seed রান করুন। *(2026-11-16-এ সম্পাদিত — drill প্রজেক্ট `byhqzvorpnprcxzfkkyd`; নমুনা ডেটা → export → wipe → restore → যাচাই সব সবুজ; প্রজেক্টটি মুছে ফেলা যায়।)*
2. লাইভ অ্যাপ থেকে একটি ছোট JSON ব্যাকআপ নিন: admin → Settings → **সব ডেটা JSON ডাউনলোড**।
3. টেস্ট প্রজেক্টের সব টেবিল wipe করুন (SQL Editor):
   ```sql
   truncate public.design_proofs, public.order_files, public.order_events,
             public.payments, public.order_items, public.orders restart identity cascade;
   ```
4. রিস্টোর:
   ```bash
   python3 tools/backup-to-sql.py /path/to/shebaghor-backup-YYYY-MM-DD.json > /tmp/restore.sql
   ```
   `restore.sql`-এর কনটেন্ট SQL Editor-এ পেস্ট → Run (pg_read_file hosted-এ নেই, তাই এই পথ)।
5. যাচাই: `select count(*) from orders;` ব্যাকআপের সংখ্যার সাথে মেলা; `track_order('<টোকেন>','<ফোন>')` রেজাল্ট দেয়; নতুন অর্ডারের টোকেন `max+1`।
6. পরীক্ষা শেষে **টেস্ট প্রজেক্ট মুছে ফেলুন** (Project Settings → Delete project) → ফ্রি টায়ারের 2-প্রজেক্ট হেডরুম বজায় থাকবে।

## ধাপ 6 — দ্বি-অ্যাকাউন্ট RLS ক্লিক-থ্রু (P4-02)
দুইটি ব্রাউজার প্রফাইল: **A** = কাস্টমার B (দ্বিতীয় অ্যাকাউন্ট), **B** = guest উইন্ডো; এডমিন-সেশন আলাদা। প্রতিটি চেক সবুজ হওয়া চাই:
| # | চেক | প্রত্যাশা |
|---|---|---|
| 1 | A-এর অর্ডার A-এর `my-orders`-এ দৃশ্যমান; B-তে লগইন করা A | ❌ A-এর অর্ডার B-তে **অদৃশ্য** |
| 2 | guest: টোকেন+ফোন দিয়ে track | ✅ শুধু ওই অর্ডার; অন্য কারো টোকেন+ভুল ফোন → "পাওয়া যায়নি" (একই বার্তা) |
| 3 | anonymous (কুলকিহীন) `orders` টেবিল SELECT API-তে | ❌ 0 row |
| 4 | non-admin advance (`advance_order_status`) | ❌ `forbidden` |
| 5 | non-admin service যোগ/মূল্য বদল | ❌ RLS block |
| 6 | proofs: A-এর proof B-তে অদৃশ্য; সরাসরি storage path | ❌ ইরর/403 |
| 7 | admin: সব অর্ডার/প্রুফ দেখা + advance + verify | ✅ |
| 8 | signed URL (120s) — মেয়াদ শেষে পুনর্ব্যবহৃত | ❌ ব্যর্থ |
কোনো একটি লাল হলে → **tag দেবেন না**; লগ সহ সমস্যা ঠিক (প্রয়োজনে `06_Plan.md`-এ (TEST) নোট) করিয়ে জমা দিন।

## ধাপ 7 — বাস্তব Android-এ Lighthouse (P4-05)
1. মোবইল Chrome → Pages URL → DevTools → Lighthouse → Mobile + Performance ও Accessibility → "Fast 3G" throttling সহanalyze।
2. লক্ষ্য: **Perf ≥ 90** (বা অন্তত devtools-throttled ~99-এর ধারায়), **A11y ≥ 95**, catalog < 2.5s।
3. ফলাফল `docs/06_Plan.md` P4-05-এ তারিখসহ লিখুন; simulate-স্কোর কম হলে (CPU-limited) তা নথিভুক্ত করে devtools থ্রটলড সংখ্যাটি গ্রহণ করুন।

## ধাপ 8 — iOS Safari স্পট-চেক (P4-08/10-এর অংশ)
iPhone/iPad Safari: হোম পেজ → অর্ডার → আপলোড → টোকেন; admin → print → **A5 প্রিন্ট ডায়ালগ** (Safari print preview)। সমস্যা হলে `06_Plan.md`-এ (TEST) নোট।

## ধাপ 9 — মালিকের Walkthrough (P4-10, ~৩০ মিনিট)
1. মালিককে মোবইলে লাইভ সাইট দিন → নিজে অর্ডার করতে দিন (যেমন ১০টি B&W A4)।
2. TrxID/নগদ/বিকাশ — আসল প্রবাহ দেখান; admin প্যানেল অপারেশন দেখান: কিউ → বিস্তার → advance → প্রিন্ট।
3. WhatsApp শেয়ার + বাকি-লেজার (`admin-reports` → বাকি ট্যাব → wa.me রিমাইন্ডার) দেখান।
4. মালিককে **নিজে** একবার পুরোটা করতে দিন; জমাট বেঁধে একটি **হ্যান্ডওভার স্লিপ** দিন (Ready-made printable: `docs/handover-checklist.html` — প্রিন্ট করে পুরন করুন, A4):
   - সাপ্তাহিক: admin → Settings → সব ডেটা JSON → Drive আপলোড (মাসে ১ বার দলিল সহায়কের, সপ্তাহে ১ বার সেবাঘরের)।
   - NID ফাইল রোজ নয়, **মাসে ১ বার** মুছুন (admin → Settings → "৩০ দিনের পুরোনো NID ফাইল মুছুন")।
   - ফ্রি টায়ার সীমা: Storage 1GB / DB 500MB — `admin-reports`-এর কাউন্টার চেক রাখুন।
   - সমস্যা হলে: `git tag v1.0.0` ট্যাগেই নজর রাখুন; রিভার্ট = `git revert <commit> && git push` (Pages ~১ মিনিটে রোলব্যাক)।

## ধাপ 10 — v1.0.0 ট্যাগ (P4-09)
সব `[ ]` (P0-01..07, P4-02, P4-05, P4-06, P4-10) তারিখসহ `[x]` হলে:
```bash
cd /home/user/dolil-app
sed -i 's/(২০২৬-১৬-১১)//; s/Phase 4 চলছে/Phase 4 সম্পন্ন/' README.md   # স্ট্যাটাস আপডেট
git add -A && git commit -m "plan: P4-02/05/06/10 tick with hosted results; README status final"
git tag -a v1.0.0 -m "Shebaghor v1.0.0 — hosted release (Pages + Supabase)"
git push origin main --tags
```
Drive-এর `সেবাঘর — Spec Docs` ফোল্ডারের `05/06` আপডেট থাকলে একই পালায় রি-আপলোড করুন (standing rule)।

---

## রোলব্যাক / রিকভারি
- **অ্যাপ ভাঙলো (পেজে ইরর):** `git revert <bad-commit> && git push` — Pages অটো-রোলব্যাক (~১ মি)।
- **DB খারাপ হলো (মানুষের ভুল delete):** `tools/restore-backup.sql` (local PG) বা `tools/backup-to-sql.py` (hosted SQL editor) — দুটোই `docs/06_Plan.md` P4-06-এর পদ্ধতি; **ট্রান্স্যাকশন + ফরেন-কী-নিরাপদ** — আংশিক রিস্টোর সম্ভব নয়; corrupt ফাইল হলে clear বার্তাসহ বাতিল (exit 3), ডেটা গলে যায় না।
- **config ভুল হলো:** `config.js` রিভার্ট করে push — সাইট সেটআপ-ব্যানারে ফেরৎ যায়, ডেটা অক্ষুণ্ণ (DB Supabase-এই থাকে)।
- **Supabase ডাউন:** কাস্টমার অর্ডার সাময়িক বন্ধ; দোকান ম্যানুয়ালি (টোকেন প্যাড) চালাবে; Supabase-এ অর্ডার একবার সেভ হলে তা ঘরের Drive-ব্যাকআপে সংরক্ষিত।

## সাপ্তাহিক রক্ষণাবেক্ষণ (রিলিজের পর)
| কবে | কী |
|---|---|
| সাপ্তাহিক | admin → Settings → সব ডেটা JSON → Drive ভল্টে |
| মাসিক | NID-purge; Storage/DB usage গ্ল্যান্স; সেবা ও দাম অডিট |
| ত্রৈমাসিক | Supabase preview/upgrade নোটিশ; ফন্ট/icon আপডেট দরকার হলে নতুন রিলিজ |
| নতুন রিলিজ | `v1.x.y` ট্যাগ; Pages auto-deploy; `sw.js` CACHE বাম্প করতে ভুলবেন না (কাস্টমার PWA ক্যাশ) |

*ডকুমেন্ট মালিক: ডেভ; পরিবর্তন = একই কমিটে 06_Plan নোট + Drive re-upload।*
