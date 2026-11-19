/* সেবাঘর — calculator + shop arithmetic (no eval) */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
  var $ = function (s) { return document.querySelector(s); };
  var display = $('#display'), expr = '';
  var bnDigits = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
  function toBn(s) { return String(s).replace(/[0-9]/g, function (d) { return bnDigits[+d]; }); }
  function show() { display.textContent = toBn(expr === '' ? '0' : expr); }
  var keys = ['C','(',')','÷','7','8','9','×','4','5','6','−','1','2','3','+','0','.','%','='];
  var keysEl = $('#keys');
  keys.forEach(function (k) {
    var b = document.createElement('button');
    b.textContent = toBn(k);
    b.setAttribute('aria-label', k);
    if ('÷×−+=('.indexOf(k) > -1 || k === ')') b.classList.add('op');
    if (k === '=') b.classList.add('eq');
    b.addEventListener('click', function () { press(k); });
    keysEl.appendChild(b);
  });
  function press(k) {
    if (k === 'C') { expr = ''; show(); return; }
    if (k === '=') { try { expr = String(calc(expr)); } catch (e) { expr = 'ভুল হিসাব'; } show(); return; }
    if (expr === 'ভুল হিসাব') expr = '';
    expr += k; show();
  }
  // tokeniser + shunting-yard-lite (precedence climbing)
  function calc(src) {
    var s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
    var tokens = s.match(/\d+\.?\d*|\.\d+|[()+\-*/%]/g);
    if (!tokens) throw new Error('empty');
    var pos = 0;
    function peek() { return tokens[pos]; }
    function next() { return tokens[pos++]; }
    function parseExpr() {
      var v = parseTerm();
      while (peek() === '+' || peek() === '-') { var op = next(); var r = parseTerm(); v = op === '+' ? v + r : v - r; }
      return v;
    }
    function parseTerm() {
      var v = parseFactor();
      while (peek() === '*' || peek() === '/' || peek() === '%') { var op = next(); var r = parseFactor(); v = op === '*' ? v * r : op === '/' ? v / r : v % r; }
      return v;
    }
    function parseFactor() {
      var t = next();
      if (t === '(') { var v = parseExpr(); if (next() !== ')') throw new Error('paren'); return v; }
      if (t === '-') return -parseFactor();
      var n = parseFloat(t);
      if (isNaN(n)) throw new Error('num');
      return n;
    }
    var result = parseExpr();
    if (pos !== tokens.length) throw new Error('trailing');
    return Math.round(result * 1e10) / 1e10;
  }
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    var map = { '*': '×', '/': '÷', '-': '−', '+': '+', '=': '=', 'Enter': '=', 'Backspace': 'BACK', 'Escape': 'C' };
    var k = map[e.key] || (/^[0-9().%]$/.test(e.key) ? e.key : null);
    if (!k) return;
    if (k === 'BACK') { expr = expr.slice(0, -1); show(); return; }
    press(k);
  });
  // shop calculator
  var scTotal = $('#scTotal'), scDisc = $('#scDisc'), scVat = $('#scVat'), scPaid = $('#scPaid'), scOut = $('#scOut');
  function shopCalc() {
    var total = parseFloat(scTotal.value) || 0, disc = parseFloat(scDisc.value) || 0, vat = parseFloat(scVat.value) || 0, paid = parseFloat(scPaid.value) || 0;
    if (total <= 0) { scOut.textContent = 'মান দিন — হিসাব এখানে দেখাবে।'; return; }
    var discAmt = total * disc / 100, afterDisc = total - discAmt, vatAmt = afterDisc * vat / 100, grand = afterDisc + vatAmt, due = Math.max(0, grand - paid), change = Math.max(0, paid - grand);
    scOut.innerHTML = 'ছাড়: ৳' + discAmt.toFixed(2) + ' · ভ্যাট: ৳' + vatAmt.toFixed(2) + '<br><b>সর্বমোট: ৳' + grand.toFixed(2) + '</b><br>' + (paid > 0 ? (due > 0 ? 'বাকি: ৳' + due.toFixed(2) : 'ফেরত: ৳' + change.toFixed(2)) : 'টাকা দিলে বাকি/ফেরত দেখাবে');
  }
  [scTotal, scDisc, scVat, scPaid].forEach(function (el) { el.addEventListener('input', shopCalc); });
  var prQty = $('#prQty'), prTotal = $('#prTotal'), prOut = $('#prOut');
  function unitCalc() {
    var q = parseFloat(prQty.value), t = parseFloat(prTotal.value);
    if (!(q > 0) || !(t >= 0)) { prOut.textContent = 'প্রতি একক দাম এখানে দেখাবে।'; return; }
    prOut.innerHTML = '<b>প্রতি একক: ৳' + (t / q).toFixed(2) + '</b><br>' + toBn(String(q)) + ' একক × ৳' + (t / q).toFixed(2);
  }
  prQty.addEventListener('input', unitCalc); prTotal.addEventListener('input', unitCalc);
});
