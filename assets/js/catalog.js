/* সেবাঘর — catalog.js — shared catalog logic: fetch, search, filter, sort, category labels */
'use strict';
window.CATEGORY_BN = {
  print: 'প্রিন্ট', photocopy: 'ফটোকপি', scan: 'স্ক্যান', typing: 'টাইপিং', photo: 'ছবি',
  online: 'অনলাইন সেবা', design: 'ডিজাইন', deed: 'দলিল', other: 'অন্যান্য',
};

/** Fetch active services (anon-friendly). Returns {data, error}. */
async function fetchServices() {
  if (!SB.client) return { data: null, error: new Error('no-config') };
  return SB.client.from('services')
    .select('id, slug, name_bn, description_bn, category, unit_bn, base_price, requires_file, eta_bn, sort_order, options_schema')
    .eq('active', true)
    .order('sort_order', { ascending: true });
}

function serviceCardHTML(s) {
  const esc = window.DG.esc, fmt = window.DG.fmtMoney;
  const req = s.requires_file ? '<span class="small muted" title="ফাইল সাথে দিতে হবে">ফাইল লাগবে</span>' : '';
  return '' +
    '<article class="card service-card" data-slug="' + esc(s.slug) + '">' +
      '<div class="service-card-body">' +
        '<h3>' + esc(s.name_bn) + '</h3>' +
        (s.description_bn ? '<p class="small muted">' + esc(s.description_bn) + '</p>' : '') +
        '<div class="row" style="justify-content:space-between;align-items:flex-end;margin-top:auto;padding-top:12px">' +
          '<div><div class="service-price">' + fmt(s.base_price) + '<span class="small muted"> / ' + esc(s.unit_bn) + '</span></div>' + req + '</div>' +
          '<a class="btn btn-primary btn-small" href="service.html?slug=' + encodeURIComponent(s.slug) + '">বিস্তারিত</a>' +
        '</div>' +
      '</div>' +
    '</article>';
}

/** Simple client search: name+description+slug substring, Bengali-safe (lowercase noop) */
function matchSearch(s, q) {
  if (!q) return true;
  const hay = (s.name_bn + ' ' + (s.description_bn || '') + ' ' + s.slug + ' ' + (window.CATEGORY_BN[s.category] || '')).toLowerCase();
  return hay.includes(q.toLowerCase());
}

async function fetchPopularity() {
  if (!SB.client) return {};
  const { data, error } = await SB.client.rpc('service_popularity');
  if (error || !data) return {};
  const map = {};
  for (const row of data) map[row.service_id] = Number(row.orders) || 0;
  return map;
}

function sortServices(list, mode, popularity) {
  const arr = [...list];
  if (mode === 'price-asc') arr.sort((a, b) => a.base_price - b.base_price);
  else if (mode === 'price-desc') arr.sort((a, b) => b.base_price - a.base_price);
  else if (mode === 'popular' && popularity) {
    arr.sort((a, b) => (popularity[b.id] || 0) - (popularity[a.id] || 0) || a.sort_order - b.sort_order);
  } else arr.sort((a, b) => a.sort_order - b.sort_order);
  return arr;
}

/* ===== Order draft (localStorage) ===== */
const DRAFT_KEY = 'shebaghor.orderDraft.v1';
function getDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY)) || blankDraft(); }
  catch { return blankDraft(); }
}
function blankDraft() {
  return { v: 1, items: [], files: [], customer: {}, pickup_slot: '', payment_method: 'cash_on_pickup', trx_id: '', wa_opt_in: true };
}
function saveDraft(d) { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); }
function clearDraft() { localStorage.removeItem(DRAFT_KEY); }
function draftTotal(d) { return d.items.reduce((sum, it) => sum + Math.round(it.qty * it.unit_price), 0); }

/** Add (or merge) a line item into the draft. Returns the draft. */
async function addToDraft(serviceId, qty = 1, options = {}) {
  if (!SB.client) return null;
  const { data: s, error } = await SB.client.from('services')
    .select('id, slug, name_bn, unit_bn, base_price, requires_file').eq('id', serviceId).eq('active', true).single();
  if (error || !s) return null;
  const q = Math.max(1, Number(qty) || 1);
  const d = getDraft();
  const existing = !Object.keys(options || {}).length && d.items.find(it => it.service_id === s.id && !Object.keys(it.options || {}).length);
  if (existing) existing.qty += q;
  else d.items.push({ service_id: s.id, slug: s.slug, name_bn: s.name_bn, unit_bn: s.unit_bn, unit_price: s.base_price, qty: q, options: options || {}, requires_file: !!s.requires_file });
  saveDraft(d);
  return d;
}

window.CATALOG = { fetchServices, fetchPopularity, serviceCardHTML, matchSearch, sortServices, CATEGORY_BN: window.CATEGORY_BN,
  getDraft, blankDraft, saveDraft, clearDraft, draftTotal, addToDraft, DRAFT_KEY };
