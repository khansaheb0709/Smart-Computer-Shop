/* সেবাঘর — admin: job board CRUD (admin-only via SB.requireAdmin) */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
  var $ = function (s) { return document.querySelector(s); };
  var grid = $('#jobsList');
  var esc = function (s) { var d = document.createElement('div'); d.textContent = String(s == null ? '' : s); return d.innerHTML; };
  var editing = false;

  (async function init () {
    if (!window.SB || !SB.client) { return; }
    var { data: { session } } = await SB.client.auth.getSession();
    if (!session) { location.replace('login.html?next=admin-jobs.html'); return; }
    var role = await SB.requireAdmin();
    if (role !== 'admin') { $('#gate403').hidden = false; return; }
    $('#adminArea').hidden = false;
    load();
  })();

  function formData() {
    return {
      title_bn: $('#title_bn').value.trim(),
      company: $('#company').value.trim() || 'সেবাঘর',
      category: $('#category').value,
      job_type: $('#job_type').value,
      whatsapp: $('#whatsapp').value.replace(/\D/g, ''),
      location_bn: $('#location_bn').value.trim() || null,
      salary_bn: $('#salary_bn').value.trim() || null,
      deadline: $('#deadline').value || null,
      description_bn: $('#description_bn').value.trim(),
      requirements_bn: $('#requirements_bn').value.trim() || null
    };
  }
  function resetForm() {
    editing = false;
    $('#jobId').value = ''; $('#jobForm').reset(); $('#company').value = 'সেবাঘর'; $('#formTitle').textContent = 'নতুন বিজ্ঞপ্তি';
    $('#cancelEditBtn').hidden = true; $('#saveBtn').textContent = 'সেভ করুন';
  }
  $('#cancelEditBtn').addEventListener('click', resetForm);

  $('#jobForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!SB.client) return;
    var data = formData();
    if (!/^01[3-9][0-9]{8}$/.test(data.whatsapp)) { alert('সঠিক WhatsApp নম্বর দিন (01XXXXXXXXX)'); return; }
    if (data.description_bn.length < 10) { alert('বিবরণ কমপক্ষে ১০ অক্ষরের হতে হবে'); return; }
    var btn = $('#saveBtn'); btn.setAttribute('aria-busy', 'true');
    var id = $('#jobId').value;
    var res = id
      ? await SB.client.from('job_posts').update(data).eq('id', id)
      : await SB.client.from('job_posts').insert(data);
    btn.removeAttribute('aria-busy');
    if (res.error) { alert('সংরক্ষণ ব্যর্থ: ' + res.error.message); return; }
    resetForm(); load();
  });

  async function load() {
    if (!SB.client) return;
    var res = await SB.client.from('job_posts').select('*').order('created_at', { ascending: false });
    if (res.error) { grid.innerHTML = '<p class="muted">লোড ব্যর্থ: ' + esc(res.error.message) + '</p>'; return; }
    var posts = res.data || [];
    if (!posts.length) { grid.innerHTML = '<p class="muted">এখনো কোনো বিজ্ঞপ্তি নেই — উপরের ফর্ম থেকে যোগ করুন।</p>'; return; }
    grid.innerHTML = '';
    posts.forEach(function (p) {
      var d = document.createElement('article');
      d.className = 'job-card';
      d.style.borderLeftColor = p.active ? 'var(--green)' : '#bbb';
      d.innerHTML = '<div class="job-meta"><span class="badge" style="background:' + (p.active ? 'var(--green)' : '#999') + '">' + (p.active ? 'চালু' : 'বন্ধ') + '</span> <span>' + esc(p.category) + '</span><span>' + esc(p.job_type) + '</span></div>' +
        '<h2>' + esc(p.title_bn) + '</h2>' +
        '<p class="hint" style="margin:2px 0 6px">' + esc(p.company) + ' · WhatsApp: ' + esc(p.whatsapp) + (p.deadline ? ' · শেষ: ' + esc(p.deadline) : '') + '</p>' +
        '<p style="white-space:pre-line;margin:0 0 8px">' + esc(p.description_bn) + '</p>' +
        '<div class="btn-row">' +
          '<button class="btn btn-ghost btn-small" data-act="edit">✏️ সম্পাদনা</button>' +
          '<button class="btn btn-ghost btn-small" data-act="toggle">' + (p.active ? '⏸️ বন্ধ করুন' : '▶️ চালু করুন') + '</button>' +
          '<button class="btn btn-ghost btn-small" data-act="delete" style="color:var(--danger)">🗑️ মুছুন</button>' +
        '</div>';
      d.querySelector('[data-act="edit"]').addEventListener('click', function () {
        editing = true; $('#jobId').value = p.id;
        $('#title_bn').value = p.title_bn; $('#company').value = p.company || 'সেবাঘর';
        $('#category').value = p.category; $('#job_type').value = p.job_type; $('#whatsapp').value = p.whatsapp;
        $('#location_bn').value = p.location_bn || ''; $('#salary_bn').value = p.salary_bn || ''; $('#deadline').value = p.deadline || '';
        $('#description_bn').value = p.description_bn || ''; $('#requirements_bn').value = p.requirements_bn || '';
        $('#formTitle').textContent = 'বিজ্ঞপ্তি সম্পাদনা'; $('#cancelEditBtn').hidden = false; $('#saveBtn').textContent = 'আপডেট করুন';
        $('#jobForm').scrollIntoView({ behavior: 'smooth' });
      });
      d.querySelector('[data-act="toggle"]').addEventListener('click', async function () {
        var r = await SB.client.from('job_posts').update({ active: !p.active }).eq('id', p.id);
        if (r.error) alert('ব্যর্থ: ' + r.error.message); else load();
      });
      d.querySelector('[data-act="delete"]').addEventListener('click', async function () {
        if (!confirm('এই বিজ্ঞপ্তিটি মুছে যাবে। নিশ্চিত?')) return;
        var r = await SB.client.from('job_posts').delete().eq('id', p.id);
        if (r.error) alert('ব্যর্থ: ' + r.error.message); else load();
      });
      grid.appendChild(d);
    });
  }
});
