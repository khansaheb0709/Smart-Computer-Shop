/* সেবাঘর — dom.js — tiny DOM helpers. No framework. */
'use strict';
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Escape any string for safe HTML insertion (user/DB content). */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

/** ৳ money with en-IN grouping, integer taka (no paisa). */
function fmtMoney(n) {
  const v = Math.round(Number(n) || 0);
  return '৳' + v.toLocaleString('en-IN');
}

/** Latin digits → Bengali digits (receipts when bn_digits=on). */
function toBnDigits(s) {
  return String(s).replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[Number(d)]);
}

/** Bengali digits → Latin (before regex/parseInt). */
function toLatinDigits(s) {
  return String(s).replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
}

/** Toast — dark-green pill, role=status. Never silently fails. */
let toastTimer = null;
function toast(msg, ms = 3500) {
  let el = $('#appToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'appToast'; el.className = 'toast'; el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/** Button loading state (aria-busy) with auto-revert. Returns revert fn. */
function btnBusy(btn, ms = 2500) {
  btn.setAttribute('aria-busy', 'true');
  const t = setTimeout(() => btn.removeAttribute('aria-busy'), ms);
  return () => { clearTimeout(t); btn.removeAttribute('aria-busy'); };
}

/** Simple focus trap for .modal-overlay (Esc + backdrop close). */
function trapFocus(overlay) {
  const focusables = () => $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', overlay)
    .filter(el => !el.disabled && el.offsetParent !== null);
  overlay.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const f = focusables(); if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal(overlay); });
}
function openModal(overlay) {
  overlay.classList.add('open');
  const f = $('input, select, textarea, button', overlay);
  if (f) f.focus();
}
function closeModal(overlay) { overlay.classList.remove('open'); }

/** Phone validation — Bangladeshi mobile (01X…, 11 digits after normalization). */
const PHONE_RE = /^01[3-9][0-9]{8}$/;
function normalizePhone(raw) {
  let p = toLatinDigits(String(raw || '')).replace(/\D/g, '');
  if (p.startsWith('880')) p = p.slice(2);  // 8801XXXXXXXXX → 01XXXXXXXXX
  if (p.startsWith('+')) p = p.slice(1);
  return p;
}

window.DG = { $, $$, esc, fmtMoney, toBnDigits, toLatinDigits, toast, btnBusy, trapFocus, openModal, closeModal, normalizePhone, PHONE_RE };
