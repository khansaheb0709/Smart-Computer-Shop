# 03 — UI Design System Spec
**Product:** সেবাঘর (Shebaghor) · **Version:** 1.0 · **Date:** 2026-11-13
Rule: one source of truth = CSS custom properties in `/assets/css/tokens.css`. No hardcoded hex in components.

---

## 1. Color tokens (exact hex)
### Brand — deep legal/shop green + antique gold (shared with দলিল সহায়ক identity)
```
--green-900:#0d3b2e;  --green-800:#114b3a;  --green-700:#155c47;  --green-600:#1b6e54;  --green-500:#23805f;
--gold:#c9a227;       --gold-light:#e7c86b; --gold-soft:#f6ecd2;  --gold-deep:#8a6d12;
--paper:#f7f5ee;      --card:#ffffff;        --ink:#1c2a21;        --muted:#5f7166;      --line:#e2dfd2;
--danger:#b3261e;     --danger-soft:#fdf0ef; --danger-line:#e5b6b3;
--ok:#146c43;         --ok-soft:#eef6ef;     --amber:#9a6b00;      --amber-soft:#fffbe8; --amber-line:#e7d89a;
--info:#123a5e;       --info-soft:#eef3fb;
```
### Dark theme (admin night counter — Phase 4, not MVP)
```
--green-900:#07241b; --card:#101f19; --paper:#0a1712; --ink:#e9e6d8; --muted:#8fae9d; --line:#1e3a2f;
--gold:#c9a227 (unchanged); shadows drop opacity .5; images keep white bg for print docs.
```
Dark rules: never invert the gold; keep 4.5:1 contrast on `--ink`/`--card`; charts use gold/green tints, not red/green alone (color-blind safe: pair with shape/label).

### Semantic mapping
| Purpose | Token |
|---|---|
| Primary action | `--green-700` bg, white text |
| Secondary/CTA gold | `--gold-light`→`--gold` gradient, `#3d2e05` text |
| Success / ready | `--ok` on `--ok-soft` |
| Warning / pending | `--amber` on `--amber-soft` |
| Error / due | `--danger` on `--danger-soft` |
| Info | `--info` on `--info-soft` |
| Focus ring | 3px `rgba(27,110,84,.35)` (dark bg: `rgba(231,200,107,.4)`) |

## 2. Typography
**Families (in order):** `'Noto Serif Bengali','Kalpurush','SolaimanLipi',serif` for display/headings & deed/receipt print; `'Noto Sans Bengali','Noto Serif Bengali',system-ui,sans-serif` for UI body. Fallback always system → offline OK; Google Fonts `<link>` is progressive enhancement only.
**Numerals:** Latin digits default in inputs/tables; Bengali digits in receipts/deeds when `bn_digits=on` (toggle in admin settings). CSS `font-variant-numeric: tabular-nums` in all money/qty cells.

| Step | Size / line-height | Weight | Use |
|---|---|---|---|
| display | 32/1.2 | 800 | Home hero |
| h1 | 26/1.25 | 800 | Page title |
| h2 | 20/1.3 | 800 | Card section title |
| h3 | 16/1.35 | 700 | Sub-section |
| body | 14/1.55 | 400 | Default |
| small | 12/1.5 | 400 | Hints, table meta |
| micro | 10.5/1.4 | 600 | Labels, caps (letter-spacing .08em) |

## 3. Spacing & layout
- **4px base grid.** Scale: 4,8,12,16,20,24,32,48,64. Section gap 18–24px; card padding 16–18px (24px desktop).
- **Radius:** sm 8px, md 12px, lg 14px, pill 999px. **Shadow:** `0 1px 2px rgba(16,42,30,.06), 0 8px 24px rgba(16,42,30,.08)`; hover lift = shadow + `translateY(-2px)`.
- **Breakpoints:** sm ≤640 (stack, single column), md ≤860 (sidebar off-canvas — internal tool; customer site has top nav), lg ≤1100 (2-col grids → 1), ≥1440 max content 1200px centered.
- **Touch targets:** ≥44×44px; primary buttons ≥48px height on mobile.
- **Z-index:** base 0 · sticky topbar 40 · overlay 55 · sidebar 60 · modal 100 · toast 200.

## 4. Components & states
### Buttons (`.btn`)
| Variant | Default | Hover | Active | Disabled |
|---|---|---|---|---|
| primary | green-700/white | brightness 1.1 | translateY(1px) | opacity .55, no pointer |
| gold | gradient gold, #3d2e05 | same | translateY(1px) | opacity .55 |
| ghost | white, green-800 border | #f0f4ee | — | — |
| danger | white, danger text/border | danger-soft | — | — |
| icon-btn | 34px square, line border | #eef3ee | — | — |
Loading state: spinner replaces icon, `aria-busy="true"`, width locked (no layout shift), 2.5s max then revert + toast on timeout.

### Inputs (`.control`)
Default 1.5px `--line`-ish border (#d8d4c6), radius 9px, min-height 38px (44 mobile) · focus: border `--green-600` + 3px ring · error: border `--danger` + inline msg below (12px, danger icon) · disabled: #f2f1e9 bg · readonly: same as disabled · with unit suffix (৳/pcs): right-aligned suffix span inside input wrapper.

### Cards
White bg, 1px `--line`, radius lg, soft shadow; optional top accent bar 3px gold for "featured/ready" cards. Card title row: 20px gold icon + h2 + bottom hairline `--gold-soft` 2px.

### Chips (category filters)
Pill, `--card` border `--line`; active: `--green-800` bg + `#ffe9a8` text. Count badge optional right.

### Tables
`th` green-800 bg, `#f2efd9` text, 12px, letter-spacing .04em, sticky on scroll containers; zebra rows `#fbfaf4`; hover `#f3f6ec`; numeric cols right + tabular-nums; row click → detail; skeleton rows (5) shimmer on loading.

### Badges (status)
`placed` amber-soft · `pending_verification` info-soft · `confirmed` info-soft · `in_progress` `--green-600` soft · `ready` ok-soft bold · `completed` neutral · `cancelled` danger-soft · `due>0` danger outline pill.

### Toasts / Modals / Empty states
Toast: dark green pill bottom-center, gold border-left, 3.5s, `role=status`. Modal: overlay blur 4px, card radius lg, header + body + footer; `Esc` and backdrop click close (except destructive confirm — require button); focus trap. Empty states: 44px muted SVG + one-line BN + CTA button. Skeletons for catalog grid & queue list.

### Receipt print (A5)
Mono-ish (`'Courier New', monospace`, 12px), dashed hr, shop header centered, token line bold, item rows, total box, footer "ধন্যবাদ, আবার আসবেন!" — paper white, no shadows/borders. Print CSS hides everything except `#printSheet`.

## 5. Accessibility (WCAG 2.1 AA target)
- Body text ≥ 4.5:1; large text ≥ 3:1; gold-on-white never for text < 14px (use `--gold-deep`).
- All inputs have `<label>`; icon-only buttons have `aria-label`; modals `role=dialog aria-modal` + focus trap + initial focus.
- Focus-visible ring always visible; skip-link to main content.
- Motion: `@media (prefers-reduced-motion: reduce)` disables transitions/animations.
- Forms: errors announced via `aria-live="polite"`.
- Bengali screen-reader: semantic headings order, real text (no text-as-image except logo with alt).

## 6. Iconography & imagery
Inline SVG only (stroke 1.8–2, round caps, Lucide-style), 20–24px; no emoji anywhere. Photos (shop, samples): max 1600px, WebP with JPG fallback, `loading=lazy`, alt text in Bengali. Logo: document+check mark SVG (see `/assets/img/icon.svg`), gold on green, clear-space ≥ ½ height.

## 7. File conventions
`tokens.css` (variables) → `base.css` (reset/layout) → `components.css` (btn/card/table/…) → `print.css` (A5 receipt, A4 deed handoff). Pages link the GENERATED `assets/css/bundle.css` (all of the above + `app.css`/`shop.css`/`auth.css` + `fonts.css`); rebuild with `tools/bundle-css.sh`. Page-specific CSS co-located. No inline `style=` except dynamic SVG/canvas dimensions.
