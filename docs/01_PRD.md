# 01 — Product Requirements Document (PRD)
**Product:** সেবাঘর (Shebaghor) — Daulatpur Computer & Print Customer Platform
**Internal counterpart (already built, working):** দলিল সহায়ক (Dolil Sohoyok) — offline-first single-file internal app (`/internal/index.html`)
**Version:** 1.0 · **Date:** 2026-11-13 · **Owner:** Shop owner, Daulatpur Bazar, Khulna Division, Bangladesh
**Status:** Locked for MVP build · change only via doc review

---

## 1. Core problem
The shop (computer service, photocopy & printing, graphics/design work, online government-service assistance, deed writing) operates 100% walk-in:

1. Customers waste time coming to the shop, then waiting in queue to know price, turnaround time, and whether files are correct.
2. Jobs arrive with missing/wrong files (unprintable PDF, wrong photo size) → rework and disputes.
3. No order record → no accountability when work is lost/damaged, no dues tracking, no daily sales truth.
4. Design work (visiting card, wedding card, poster/banner) needs 2–3 proof corrections over weeks of WhatsApp chaos.
5. Government-service assistance (NID, BRC, passport, police clearance, e-TIN, admit cards) is done by memory — no checklist, missed papers, wrong fees quoted.
6. Owner has zero data: which services sell, who owes money, how many jobs/day, peak hours.

**Shebaghor solves #1–#6** with a Bengali-first, mobile-first, web-page-based customer platform: browse services & prices → place order with file upload → auto price → token & status tracking → pickup. The owner gets an admin dashboard replacing paper token books.

## 2. Target personas
| # | Persona | Context | Device | Key needs |
|---|---------|---------|--------|-----------|
| P1 | **Job seeker / student** (18–30) | Needs CV, printouts, admit card download, online job/admission forms | Android phone, Chrome, bKash | Live prices, fast token, track status, pay on pickup |
| P2 | **Shop owner / operator** | Runs counter all day, low IT literacy, one laptop + one phone | Windows laptop + Android | Big buttons, Bengali UI, receipt print, daily totals, dues list |
| P3 | **Event customer** (wedding/birthday) | Needs wedding card, poster, banner, photo album work | WhatsApp-heavy | Proof approval flow, bulk pricing, agreed timeline |
| P4 | **Deed client** | Land sale/gift deed drafting + government visits | Often accompanied by family | Upload NID/docs once, transparent fee estimate, document checklist |
| P5 | **Walk-in repeat customer** | Photocopy 20 pages, "same as last time" | Any phone | Reorder fast, dues at pickup |

Constraints: low bandwidth, intermittent power, many users first-time smartphone users. **Bengali UI mandatory; English secondary.**

## 3. MVP user stories (with acceptance criteria)

### Customer side
- **US-01** As a customer, I open the site on my phone and see the full service catalog with live prices — no login required. *AC: catalog renders < 2s on 3G; each card shows name (BN), unit, price in ৳, category filter works.*
- **US-02** I filter by category (প্রিন্ট / ফটোকপি / স্ক্যান / টাইপিং / ফটো / অনলাইন সেবা / ডিজাইন / দলিল). *AC: filter is instant client-side; empty category shows friendly empty state.* 
- **US-03** I select a service (e.g., "রঙিন প্রিন্ট — প্রতি পেজ"), set quantity, and see the price update live. *AC: line total = qty × unit price from DB; cannot be edited client-side.*
- **US-04** I upload my file (PDF/JPG/PNG, ≤10MB) for print/scan/design jobs. *AC: client-side type+size check; progress bar; failed upload shows retry; stored privately in Supabase Storage.*
- **US-05** I choose payment: এ দোকানে (cash/bKash/Nagad on pickup) or অগ্রিম bKash/Nagad (manual verify by owner with TrxID). *AC: TrxID field validates 10-char format; order stays `pending_verification` until owner confirms.*
- **US-06** I get a token (e.g. `টি-014`) and a tracking link. *AC: token unique per day; tracking page shows status without login via token+phone.*
- **US-07** I track my job: প্রদত্ত → কাজ চলছে → রেডি → ডেলিভারড. *AC: status timeline with timestamps; owner actions reflect within seconds (refetch/poll).*
- **US-08** I register/login (email+password or magic link) to see order history. *AC: profile auto-created on first login; forgotten password via Supabase reset email.*
- **US-09** I reorder a previous job in one tap. *AC: "আবার অর্ডার করুন" pre-fills cart from last order items (prices re-read from DB).*

### Owner/Admin side
- **US-10** Admin sees today's queue: token order, status, amount due, phone. *AC: sorted by created_at; color-coded status; one-tap call (`tel:`) and WhatsApp (`wa.me`) buttons.*
- **US-11** Admin advances status; each change is logged (who, when). *AC: `order_events` rows written; invalid jumps (e.g., delivered→processing) blocked.*
- **US-12** Admin marks payment verified (bKash TrxID matched manually) or rejected. *AC: verified → status `confirmed`; rejected → order flagged + note; customer sees update.*
- **US-13** Admin prints a token receipt (A5) from any order. *AC: receipt contains shop header, token, items, total, paid/due, date — print CSS verified.*
- **US-14** Admin manages service catalog: add/edit price, deactivate service, reorder display. *AC: price change effective immediately for new orders; old orders keep price snapshot.*
- **US-15** Admin sees daily report: orders count, revenue, dues list; exports CSV. *AC: matches raw orders; CSV opens in Excel with ৳ amounts.*
- **US-16** Design jobs enter a proof loop: admin uploads proof image → customer approves/requests changes (with note) → final. *AC: max 3 proof rounds tracked in `design_proofs`; approval timestamps stored.*
- **US-17** Admin receives any unpaid job reminder; can WhatsApp customer the due amount. *AC: prefilled wa.me text with order token + due amount.*

### System
- **US-18** Guest can place an order (name + phone only). *AC: order linked to guest phone; tracking via token+phone; no account required.*
- **US-19** Prices are **always** computed server-side (RPC `create_order`) — client cannot inject a lower price. *AC: tampering `unit_price` in devtools has no effect; total recomputed in DB.*
- **US-20** Internal counter (দলিল সহায়ক) keeps working fully offline; online sync is Phase 4 and manual (JSON export → Drive). *AC: internal app untouched by this build; no dual-write risk in MVP.*

## 4. Success metrics (first 90 days)
| Metric | Baseline | Target (90d) | Source |
|---|---|---|---|
| Online/WhatsApp orders per week | 0 | ≥ 40 | `orders` count |
| % customers pre-registering before visit | n/a | ≥ 25% | profile + order join |
| Avg rework rate (wrong files) | ~30% (est.) | ≤ 10% | orders flagged `rework` by admin |
| Average wait time at counter | ~15 min (est.) | ≤ 5 min for prepared orders | order created→completed minus pickup wait (manual sample) |
| Daily revenue visibility | none (guess) | 100% days with report | admin report usage |
| Dues collected | untracked | ≥ 80% of dues settled within 30d | dues report |
| Repeat order rate | unknown | ≥ 20% | `reorder` events |

## 5. Out of scope (Non-Goals) — strict
1. **No automatic submission to government portals** (NID/BRC/passport/TIN/railway…). Assistance = checklist + form drafting + link; final submit happens on official sites by the customer/operator.
2. **No online payment gateway integration** (no bKash/Nagad merchant API settlement). Payments are: cash on pickup, bKash/Nagad **manual TrxID verification** only.
3. **No automated SMS** (paid gateway). Notifications use `wa.me` deep links and in-app status.
4. **No home delivery/logistics tracking** — pickup only (note added for future).
5. **No multi-branch support, no SaaS for other shops.**
6. **No native Android/iOS apps** — web page + PWA manifest only.
7. **No e-commerce catalog of physical goods** — services only, not products.
8. **No English-first UX** (Bengali is primary); no RTL languages.
9. **No AI chatbot/LLM features** in the customer site.
10. **No automated legal deed generation online** — deed drafting stays in the internal দলিল সহায়ক tool with in-person verification.
11. **No customer NID storage in this system** — NID scans for document services are attached per-order, private, auto-purged after 30 days (Phase 3 policy, cron-less: manual purge button + reminder).
12. **No tax/VAT invoice automation** (Bangladesh shop below thresholds; plain receipt is enough).

## 6. Assumptions (locked decisions)
- Hosting: static web page (GitHub Pages recommended; Google Apps Script acceptable for Google-ecosystem users). **Google Drive itself cannot execute HTML/JS** — Drive is used for backups (JSON export) and asset storage only. See 04_TRD §7.
- Backend: Supabase free tier (Postgres + Auth + Storage + RLS). No custom server, no monthly cost until scale (free tier ~500MB DB, 1GB storage, 50k MAU auth).
- Internal tool (দলিল সহায়ক) remains the offline counter system in MVP; Shebaghor is the customer-facing layer + admin queue.
- Prices seeded from the current shop rate card (৳3 B&W page, ৳2 photocopy, ৳10 color, ৳15 scan, ৳40 Bangla typing/page, ৳150 CV, etc.) — editable in admin.
- Brand: **সেবাঘর (Shebaghor)**; shop legal header remains configurable via Settings.

## 7. Release phases
- **MVP (Phases 1–3 of 06_Plan):** catalog, order + guest tracking, admin queue, receipt print, payments manual verify, daily report + CSV, design proof loop.
- **Later (Phase 4+):** offline outbox sync from internal tool, dues auto-reminders, dark theme, customer "my files" vault, bKash/Nagad merchant integration (if account approved), SMS gateway.
