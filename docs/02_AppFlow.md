# 02 — App Flow & State Machine
**Product:** সেবাঘর (Shebaghor) · **Version:** 1.0 · **Date:** 2026-11-13
Notation: `Screen (route) — purpose` · `Button [Label] → action` · guards in `<brackets>`.

---

## 1. Global rules (apply to every screen)
- **R1** Bengali UI. All user-facing strings via `js/strings.js` (single source) — never inline Bengali in logic.
- **R2** Every mutating action on admin routes requires `is_admin()` (see 05_Schema §7). UI hides, RLS enforces (defense in depth).
- **R3** All money values are integer ৳ (no paisa). Display `৳ 8,50,000` (en-IN grouping) with Bengali digits if `bn_digits=on`.
- **R4** Dangerous actions (delete service, cancel order, reject payment) always go through a confirm modal.
- **R5** Every screen defines **loading / empty / error** states. No silent failures. Errors show: icon + এক লাইন বাংলা + [আবার চেষ্টা করুন].
- **R6** File uploads: accept `application/pdf, image/jpeg, image/png` only; ≤10MB each; ≤10 files/order. Client-side pre-check → server-side bucket restriction + RLS.
- **R7** Prices are never trusted from the client. The order is created by RPC `create_order()` which recomputes everything from `services`. UI totals are *display only*.
- **R8** Bandwidth-poor devices: images lazy-loaded; catalog ≤ 60KB HTML+CSS+JS initial; no framework runtime.

## 2. Route map
```
/                     Home — hero, search, ৯টি category (enum-এর সব কয়টি), popular services, "অর্ডার করুন" CTA
/services             Full catalog — search + category filter + sort (price ↑/↓, popular)
/services/:slug       Service detail — description, options (size/color/paper/binding), price, related
/order/new            Order wizard (4 steps): Configure → Upload files → Customer info → Review & confirm
/order/success/:token Token screen — big token, wa.me share, "ট্র্যাক করুন" CTA
/track                Track order — token + phone → status timeline
/login                Email+password / magic link
/signup               Name + phone + email + password
/forgot               Password reset email
/my-orders            (login) order history, reorder button, dues per order
/my-orders/:id        Order detail + proof review (for design jobs)
/admin                Dashboard — today: token queue, revenue, due, pending verifications
/admin/orders         Queue board — tabs: সব / নতুন / চলছে / রেডি / বাকি (unpaid) / cancelled
/admin/orders/:id     Order detail — status advance, payment verify/reject, print receipt, rework flag
/admin/services       Catalog CRUD — add/edit/deactivate/reorder, price change
/admin/reports        Daily/monthly summary, dues ledger, CSV export, top services chart
/admin/proofs         Design proof queue — upload proof → notify → see approve/request-changes
/admin/settings       Shop name, phone, bKash/Nagad numbers, pickup slots, receipt footer
```
Internal tool (দলিল সহায়ক, `/internal/index.html`) is a separate static app and is **not** part of this flow.

## 2a. Static multi-page route map (Vercel/Pages friendly)
The logical routes above map to physical files — no framework, no rewrite rules:
| Logical route | File (query/hash) |
|---|---|
| `/` | `index.html` |
| `/services` | `services.html` |
| `/services/:slug` | `service.html?slug=…` |
| `/order/new` | `order.html` (wizard state in `localStorage['shebaghor.orderDraft.v1']` + `#step1..4`) |
| `/order/success/:token` | `success.html` (handoff via `sessionStorage['shebaghor.lastOrder']`) |
| `/track` | `track.html` |
| `/my-orders`, `/my-orders/:id` | `my-orders.html`, `my-orders.html?id=…` |
| `/admin/orders`, `/admin/orders/:id` | `admin-orders.html`, `admin-order.html?id=…` |
| `/admin` (settings) | `admin.html` (দোকান সেটিংস + ডেটা ব্যবস্থাপনা: NID ৩০-দিন purge, JSON ব্যাকআপ) |
| `/admin/reports` | `admin-reports.html` (সারসংক্ষেপ / বাকি লেজার ট্যাব; CSV export, BOM + Latin digits) |
| `/admin/services` | `admin-services.html` (সেবা CRUD: যোগ/মূল্য/ক্রম/বন্ধ-চালু) |
| 404 | `404.html` (GitHub Pages স্বয়ংক্রিয়ভাবে দেখাবে) |
| PWA | `manifest.json` + `sw.js` (shell cache-first, SPA নেই তাই সব `.html` প্রি-ক্যাশ; Supabase API কখনো ক্যাশ নয়) + `assets/js/app-shell.js` (অফলাইন ব্যানার + install চিপ) |


## 3. Order lifecycle — state machine
```
                 ┌─────────────┐
                 │   draft     │ (client-side only, pre-submit)
                 └──────┬──────┘
                        ▼  [confirm] create_order() → server computes total
                 ┌─────────────┐   TrxID given    ┌──────────────────────┐
                 │  placed     │ ───────────────► │ pending_verification  │
                 │ (pay@shop)  │                  │ (prepaid bKash/Nagad) │
                 └──────┬──────┘                  └───────┬──────────────┘
                        │ admin [confirm]                  │ admin [verify]
                        ▼                                  ▼
                 ┌────────────────────────────────────────────┐
                 │                confirmed                     │
                 └──────┬───────────────────┬──────────────────┘
                        │ admin [start]      │ admin [reject payment] → cancelled (+note)
                        ▼                    │
                 ┌─────────────┐             │
                 │ in_progress │             │
                 └──────┬──────┘             │
                        │ admin [ready]       │
                        ▼                     │
                 ┌─────────────┐             │
                 │   ready     │             │
                 └──────┬──────┘             │
                        │ admin [deliver] + cash/bKash collected → paid
                        ▼                     │
                 ┌─────────────┐             │
                 │ completed   │             │
                 └─────────────┘             │
        any state → [cancel] (admin, reason required) ──► cancelled
```
**Transition table (actor / guard / side effects)**

| From → To | Actor | Guard | Side effects |
|---|---|---|---|
| draft → placed | customer | items ≥ 1, files ok if required | `orders`+`order_items`+`order_files` rows; `order_events(draft→placed)`; token = daily counter; UI shows /order/success/:token |
| draft → pending_verification | customer | + valid TrxID | same + `payments(trx, status=pending)` |
| placed → confirmed | admin | — | event; `wa.me` link shown with "অর্ডার কনফার্ম হয়েছে" text |
| pending_verification → confirmed | admin | TrxID visually matched in bKash/Nagad app | `payments.status=verified`, `verified_by/at`; event |
| pending_verification → cancelled | admin | reason required | payment `rejected`; customer sees reason |
| confirmed → in_progress | admin | files present if print/scan job | event; "কাজ শুরু হয়েছে" wa.me text |
| in_progress → ready | admin | all items done | event; token should print "READY" |
| ready → completed | admin | payment = paid (cash/online settled) | `paid=total, due=0`, event, receipt offered |
| any → cancelled | admin | reason required | event; if prepaid → refund note flag (manual bKash send) |
| in_progress/ready → rework flag | admin | — | `orders.rework=true` (metric US-ref §4 PRD) — no status change |

**Invalid transitions are rejected in the RPC `advance_order_status()` (single place) and hidden in UI.**

## 4. Screen-by-screen flows

### 4.1 Home (`/`)
- Hero: shop name + tagline + [অর্ডার করুন] + phone tap-to-call.
- Category chips (8) → `/services?cat=print|photocopy|scan|typing|photo|online|design|deed`.
- "জনপ্রিয় সেবা" horizontal scroll (top 6 by order count — cached 5 min).
- Footer: address, opening hours, WhatsApp button, "দোকানে আসুন" map link (Google Maps search URL — no API key needed).
- **Empty state** (first deploy, no services): illustration + "সেবা শীঘ্রই যোগ হচ্ছে — কল করুন 01XXX".

### 4.2 Catalog (`/services`)
- Search box (BN substring match on name+tags), category chips, sort dropdown (জনপ্রিয় / দাম কম→বেশি / দাম বেশি→কম).
- Card: name, unit, price, "অর্ডার" button → `/order/new?service=:slug`.
- **Empty search**: "‘xyz’ নামে কিছু পাইনি — 06XXX-এ ফোন করুন অথবা অন্য বানান চেষ্টা করুন".

### 4.3 Service detail (`/services/:slug`)
- Shows: description, options (e.g. color: B&W/রঙিন; paper: A4/Legal/A3; binding: none/spiral/hard; sides: 1-side/2-side; copies: number), live price calculator, turnaround estimate ("সাধারণত ১–৩ ঘণ্টা"), sample image (shop-assets bucket).
- [অর্ডার করুন] → `/order/new?service=:slug` with options carried in query/state.
- **Error**: unknown slug → redirect `/services` with toast.

### 4.4 Order wizard (`/order/new`)
- **Step 1 — Configure**: service + options + qty; running total (display only). [পরবর্তী] disabled until valid.
- **Step 2 — Upload files** (only for print/scan/design/document services): dropzone; per-file chip (name, size, remove); requirements hint per service ("ছবি: JPG/PNG, পাসপোর্ট সাইজ ৩৫×৪৫ মিমি"). [ফাইল ছাড়াই এগিয়ে যান] allowed only for non-file services (typing CV, online form fill).
- **Step 3 — Customer info**: toggle [আমি রেজিস্টার্ড] → login inline; else name + phone (+address if delivery note needed — MVP pickup only). Checkbox: "WhatsApp-এ অগ্রগতি পেতে চাই" (default on).
- **Step 4 — Review & confirm**: items table, total, pickup slot select (আজ সন্ধ্যা / আগামীকাল সকাল / আগামীকাল দুপুর / কাস্টম নোট), payment method radio (দোকানে পরিশোধ / bKash অগ্রিম / Nagad অগ্রিম). If prepaid: TrxID input + [পেমেন্ট সম্পন্ন করেছি].
- Submit → RPC → redirect `/order/success/:token`.
- **Errors**: file rejected → inline error with reason; RPC failure → toast + form kept (draft in localStorage auto-restore on return); price mismatch (service price changed mid-session) → server value wins, user sees updated total with notice.

### 4.5 Success (`/order/success/:token`)
- Big token `টি-014`, summary, ETA, buttons: [WhatsApp-এ ট্র্যাক লিংক শেয়ার করুন] (wa.me self/customer), [টোকেন প্রিন্ট], [আরও অর্ডার করুন].

### 4.6 Track (`/track`)
- Inputs: token (টি-014 or 14) + phone. [খুঁজুন] → RPC `track_order(token, phone)` (security definer, rate-limited).
- Timeline UI: ৫ ধাপ (অর্ডার হয়েছে → কনফার্ম → কাজ চলছে → রেডি → ডেলিভারড), current highlighted, timestamps; due amount shown if any.
- **Error**: not found → "টোকেন/ফোন মিলছে না — আবার চেক করুন" (no enumeration hints). Wrong pair 5 times → 30s cooldown message (client-side + RPC guard).
- **Empty** (no query yet): instruction card.

### 4.7 My orders (`/my-orders`)
- List: token, date, service summary, total, status badge, due badge if any, [আবার অর্ডার করুন], [বিস্তারিত]. Auth required → else redirect /login?next=/my-orders.
- **Empty**: "এখনও কোনো অর্ডার নেই — প্রথম অর্ডার করুন" + CTA.

### 4.8 Admin dashboard (`/admin`)
- Cards: আজকের অর্ডার (count), আজকের আয় (paid sum), বাকি (due sum), অগ্রিম যাচাই বাকি (pending payments count).
- Queue list (top 8 active: placed/pending_verification/confirmed/in_progress/ready) with one-tap actions; "সব দেখুন → /admin/orders".
- **Empty**: "আজ কোনো অর্ডার নেই — শান্ত দিন 🌿" (no emoji in UI: use calm SVG illustration).

### 4.9 Admin queue (`/admin/orders`)
- Tabs: সব | নতুন (placed) | যাচাই বাকি | কনফার্মড | কাজ চলছে | রেডি | বাকি (unpaid due>0) | বাতিল.
- Row: token, time, name, items summary, amount, due, status badge, [call] [wa.me] [⋯ বিস্তারিত].
- Bulk: select → [এসএমএস/WhatsApp-এ "রেডি হয়েছে" পাঠান] (opens wa.me links sequentially — manual send, no API).

### 4.10 Admin order detail (`/admin/orders/:id`)
- Left column: customer (name/phone, [কল] [WhatsApp]), items with per-item done checkbox (client-side assist; status is order-level), files with [ডাউনলোড]/[প্রিভিউ] (signed URLs, 60s), notes.
- Right column: status advance buttons (only valid next per state machine) [print receipt], payment box (TrxID, verify/reject), rework toggle, cancel with reason.
- **Edge**: concurrent admin edits → last write wins on status via RPC enum guard; shows toast if someone else advanced first.

### 4.11 Admin services (`/admin/services`)
- Table: name, category, unit, price, active toggle, sort arrows, [edit]. Add-new inline form at top. Deactivate ≠ delete (history preserved). Price edit → confirm modal "নতুন অর্ডারে দাম ৳X হবে; পুরোনো অর্ডার অপরিবর্তিত".

### 4.12 Admin reports (`/admin/reports`)
- Date range picker (default আজ), summary cards, table of orders, top-5 services bar list, dues ledger (customer, token, due, [WhatsApp-এ মনে করান]), [CSV ডাউনলোড].

### 4.13 Admin proofs (`/admin/proofs`)
- For design orders (category=design): per order, [প্রমাণ আপলোড] (image) → status `sent`; customer sees in /my-orders/:id with [অনুমোদন] / [পরিবর্তনের অনুরোধ + note]; admin sees verdict. Rounds counter; round > 3 → banner "অতিরিক্ত সংশোধন — অতিরিক্ত চার্জ প্রযোজ্য" (link settings for fee text).

### 4.14 Admin settings (`/admin/settings`)
- Shop name/address/phone/hours, bKash & Nagad numbers + names (for customer payment instructions), receipt footer line, pickup slot labels, daily manual-purge button for NID files older than 30 days (with confirm), toggle `bn_digits`.

## 5. Global empty/error patterns
- **Offline (customer site)**: banner "ইন্টারনেট নেই — অর্ডার পাঠানো যাবে না; দোকানে কল করুন 01XXX". (Internal tool works offline separately.)
- **401** on admin route → redirect /login?next=...
- **403** (not admin) → friendly "এই অংশটি দোকানের জন্য সংরক্ষিত" + link home.
- **404** → styled 404 with [হোমে ফিরুন].
- **500/RPC error** → toast + [আবার চেষ্টা]; Sentry-less: console + local error log export button in admin settings ("সমস্যা রিপোর্ট কপি করুন").
- **Upload network fail** → per-file retry chip; order not submitted until all files ok.

## 6. Notifications matrix
| Event | Channel | Template (BN) |
|---|---|---|
| Order placed | wa.me deep link (customer taps send) | "আপনার অর্ডার #টি-014 গ্রহণ হয়েছে। মোট ৳___। রেডি হলে জানানো হবে। — সেবাঘর, ডুমুরিয়া" |
| Payment verified | wa.me | "পেমেন্ট (TrxID …) যাচাই হয়েছে ✔ অর্ডার কনফার্ম হয়েছে।" |
| Ready | wa.me | "আপনার অর্ডার #টি-014 রেডি! পিকআপ করতে আসুন। বাকি ৳___।" |
| Proof sent | wa.me | "আপনার ডিজাইনের প্রমাণ প্রস্তুত — লিংকে দেখুন: /my-orders/:id" |
| Due reminder | wa.me | "আপনার বাকি ৳___ (অর্ডার #টি-014) — দয়া করে পরিশোধ করুন।" |

No automated sending in MVP — the wa.me link is prefilled; owner taps send from their WhatsApp. (Honest, zero-cost, compliant.)
