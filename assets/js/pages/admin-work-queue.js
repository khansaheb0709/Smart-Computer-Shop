/* সেবাঘর — admin work queue (kanban by status) */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { var d = document.createElement('div'); d.textContent = String(s == null ? '' : s); return d.innerHTML; };
  var bnDigits = function (s) { return String(s == null ? '' : s).replace(/[0-9]/g, function (d) { return '০১২৩৪৫৬৭৮৯'[+d]; }); };
  var COLS = [
    { id: 'queued', label: 'জমা আছে' },
    { id: 'in_progress', label: 'চলমান' },
    { id: 'waiting_customer', label: 'কাস্টমারের অপেক্ষায়' },
    { id: 'ready', label: 'তৈরি' },
    { id: 'done', label: 'সম্পন্ন' }
  ];
  var P = { 1: 'জরুরি', 2: 'সাধারণ', 3: 'পরে' };

  (async function init () {
    if (!window.SB || !SB.client) { return; }
    var { data: { session } } = await SB.client.auth.getSession();
    if (!session) { location.replace('login.html?next=admin-work-queue.html'); return; }
    var role = await SB.requireAdmin();
    if (role !== 'admin') { $('#gate403').hidden = false; return; }
    $('#adminArea').hidden = false;
    load();
  })();

  $('#taskForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!SB.client) return;
    var data = {
      title_bn: $('#title_bn').value.trim(),
      service_hint: $('#service_hint').value.trim() || null,
      customer_name: $('#customer_name').value.trim() || null,
      customer_phone: $('#customer_phone').value.replace(/\D/g, '') || null,
      priority: +$('#priority').value,
      due_date: $('#due_date').value || null,
      notes: $('#notes').value.trim() || null
    };
    var tokenRaw = $('#tokenToday').value.trim();
    if (tokenRaw) {
      var token = parseInt(tokenRaw, 10);
      if (token > 0) {
        var ord = await SB.client.from('orders').select('id').eq('order_date', new Date().toISOString().slice(0, 10)).eq('token', token).limit(1).maybeSingle();
        if (ord.data && ord.data.id) data.order_id = ord.data.id;
      }
    }
    var btn = $('#addTaskBtn'); btn.setAttribute('aria-busy', 'true');
    var res = await SB.client.from('work_tasks').insert(data);
    btn.removeAttribute('aria-busy');
    if (res.error) { alert('যোগ করা যায়নি: ' + res.error.message); return; }
    $('#taskForm').reset(); $('#priority').value = '2';
    load();
  });

  async function load() {
    var board = $('#wqBoard');
    board.innerHTML = '';
    var res = await SB.client.from('work_tasks')
      .select('id, title_bn, customer_name, customer_phone, service_hint, status, priority, due_date, notes, order_id')
      .neq('status', 'cancelled')
      .order('priority', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(300);
    if (res.error) { board.innerHTML = '<p class="muted">লোড ব্যর্থ: ' + esc(res.error.message) + '</p>'; return; }
    var tasks = res.data || [];
    $('#wqSummary').textContent = '(' + bnDigits(tasks.filter(function (t) { return t.status !== 'done'; }).length) + 'টি চলমান/জমা)';
    COLS.forEach(function (col) {
      var colEl = document.createElement('section');
      colEl.className = 'wq-col';
      var items = tasks.filter(function (t) { return t.status === col.id; });
      colEl.innerHTML = '<h2>' + esc(col.label) + '<span>' + bnDigits(items.length) + '</span></h2>';
      items.forEach(function (t) {
        var d = document.createElement('article');
        d.className = 'wq-card p' + t.priority;
        var overdue = t.due_date && t.due_date < new Date().toISOString().slice(0, 10) && t.status !== 'done';
        var meta = [t.customer_name ? esc(t.customer_name) : '', t.customer_phone ? '<a href="tel:' + esc(t.customer_phone) + '" style="color:inherit">' + bnDigits(t.customer_phone) + '</a>' : '', t.service_hint ? esc(t.service_hint) : ''].filter(Boolean).join(' · ');
        d.innerHTML = '<div class="wq-title">' + esc(t.title_bn) + '</div>' +
          (meta ? '<div class="wq-meta">' + meta + '</div>' : '') +
          '<div class="wq-meta"><span>অগ্রাধিকার: ' + P[t.priority] + '</span>' + (t.due_date ? ' · <span class="' + (overdue ? 'wq-overdue' : '') + '">শেষ: ' + bnDigits(t.due_date) + '</span>' : '') + '</div>' +
          (t.notes ? '<div class="hint">' + esc(t.notes) + '</div>' : '') +
          '<select aria-label="অবস্থা বদলান">' +
            COLS.map(function (c) { return '<option value="' + c.id + '"' + (c.id === t.status ? ' selected' : '') + '>' + c.label + '</option>'; }).join('') +
            '<option value="cancelled">বাতিল</option>' +
          '</select>' +
          '<button class="btn btn-ghost btn-small" style="margin-top:6px;color:var(--danger)">🗑️ মুছুন</button>';
        d.querySelector('select').addEventListener('change', async function (e) {
          var r = await SB.client.from('work_tasks').update({ status: e.target.value }).eq('id', t.id);
          if (r.error) alert('ব্যর্থ: ' + r.error.message); else load();
        });
        d.querySelector('button').addEventListener('click', async function () {
          if (!confirm('কাজটি মুছে যাবে। নিশ্চিত?')) return;
          var r = await SB.client.from('work_tasks').delete().eq('id', t.id);
          if (r.error) alert('ব্যর্থ: ' + r.error.message); else load();
        });
        colEl.appendChild(d);
      });
      board.appendChild(colEl);
    });
  }
});
