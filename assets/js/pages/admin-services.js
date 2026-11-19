/* সেবাঘর — admin-services page logic (extracted from admin-services.html inline <script>; DCL-guarded inside) */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
(function () {
  const { $, esc, fmtMoney, toast } = window.DG;
  const CAT = window.CATALOG;
  let services = [], filter = 'active';

  SB.setupBanner();

  const newSlug = () => 'svc-' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);

  function sorted() {
    return [...services].sort((a, b) => a.sort_order - b.sort_order || a.name_bn.localeCompare(b.name_bn, 'bn'));
  }
  function visible() {
    return sorted().filter(s => filter === 'all' ? true : filter === 'active' ? s.active : !s.active);
  }

  function render() {
    const list = visible();
    const box = $('#servicesList');
    $('#servicesEmpty').hidden = list.length > 0;
    box.setAttribute('aria-busy', 'false');
    box.innerHTML = list.map(s =>
      '<div class="queue-card' + (s.active ? '' : ' cancelled') + '" data-id="' + esc(s.id) + '" style="border-left-color:' + (s.active ? 'var(--green-600)' : 'var(--muted)') + '">' +
        '<div class="queue-info">' +
          '<div><strong>' + esc(s.name_bn) + '</strong> <span class="small muted">(' + esc(window.CATEGORY_BN[s.category] || s.category) + ' • ' + esc(s.unit_bn) + ')</span></div>' +
          '<div class="small muted">slug: <code>' + esc(s.slug) + '</code> • sort: ' + esc(String(s.sort_order)) + (s.requires_file ? ' • ফাইল লাগে' : '') + (s.eta_bn ? ' • ' + esc(s.eta_bn) : '') + '</div>' +
        '</div>' +
        '<div class="row" style="flex-wrap:nowrap">' +
          '<button class="icon-btn" data-move="up" aria-label="উপরে সরান" title="উপরে"><svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg></button>' +
          '<button class="icon-btn" data-move="down" aria-label="নিচে সরান" title="নিচে"><svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg></button>' +
          '<div class="service-price" style="font-size:18px; min-width:84px; text-align:right">' + fmtMoney(s.base_price) + '</div>' +
          '<button class="btn btn-ghost btn-small" data-edit-price="' + esc(s.id) + '">মূল্য</button>' +
          '<button class="btn btn-ghost btn-small" data-toggle-active="' + esc(s.id) + '">' + (s.active ? 'বন্ধ করুন' : 'চালু করুন') + '</button>' +
        '</div>' +
      '</div>'
    ).join('');
  }

  async function load() {
    const { data, error } = await SB.client.from('services')
      .select('id, slug, name_bn, description_bn, category, unit_bn, base_price, requires_file, eta_bn, active, sort_order')
      .order('sort_order', { ascending: true });
    if (error) { toast(window.STRINGS.errors.generic); return; }
    services = data || [];
    render();
  }

  async function swapOrder(id, dir) {
    const arr = sorted();
    const i = arr.findIndex(s => s.id === id);
    const j = dir === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= arr.length) return;
    const a = arr[i], b = arr[j];
    let newA = b.sort_order, newB = a.sort_order;
    if (newA === newB) { newA = dir === 'up' ? newB - 1 : newB + 1; }
    const r1 = await SB.client.from('services').update({ sort_order: newA }).eq('id', a.id);
    const r2 = await SB.client.from('services').update({ sort_order: newB }).eq('id', b.id);
    if (r1.error || r2.error) { toast(window.STRINGS.errors.generic); return; }
    await load();
  }

  /* ===== add form ===== */
  $('#f_category').innerHTML = Object.entries(window.CATEGORY_BN)
    .map(([k, v]) => '<option value="' + esc(k) + '">' + esc(v) + '</option>').join('');
  $('#f_slug').value = newSlug();
  $('#toggleAddBtn').addEventListener('click', () => {
    const form = $('#addForm');
    form.hidden = !form.hidden;
    if (!form.hidden) { $('#f_name').focus(); $('#f_slug').value = newSlug(); }
  });
  $('#addCancelBtn').addEventListener('click', () => { $('#addForm').hidden = true; });

  $('#addForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!SB.client) return;
    const btn = $('#addSubmitBtn'); btn.setAttribute('aria-busy', 'true');
    const maxSort = services.reduce((m, s) => Math.max(m, s.sort_order || 0), 0);
    const { error } = await SB.client.from('services').insert({
      name_bn: $('#f_name').value.trim(),
      slug: $('#f_slug').value.trim().toLowerCase(),
      category: $('#f_category').value,
      unit_bn: $('#f_unit').value.trim(),
      base_price: Math.round(Number($('#f_price').value) || 0),
      description_bn: $('#f_desc').value.trim() || null,
      eta_bn: $('#f_eta').value.trim() || null,
      requires_file: $('#f_requires_file').checked,
      active: $('#f_active').checked,
      sort_order: maxSort + 10,
    });
    btn.removeAttribute('aria-busy');
    if (error) {
      const msg = String(error.message || error);
      toast(msg.includes('duplicate') ? 'এই স্লাগ ইতিমধ্যে আছে' : window.STRINGS.errors.generic);
      return;
    }
    toast('সেবা যোগ হয়েছে');
    e.target.reset();
    $('#f_active').checked = true;
    $('#f_slug').value = newSlug();
    $('#addForm').hidden = true;
    await load();
  });

  /* ===== list actions ===== */
  $('#servicesList').addEventListener('click', async e => {
    const moveBtn = e.target.closest('[data-move]');
    const priceBtn = e.target.closest('[data-edit-price]');
    const toggleBtn = e.target.closest('[data-toggle-active]');
    if (moveBtn) {
      const id = moveBtn.closest('[data-id]').getAttribute('data-id');
      await swapOrder(id, moveBtn.getAttribute('data-move'));
      return;
    }
    if (priceBtn) {
      const id = priceBtn.getAttribute('data-edit-price');
      const s = services.find(x => x.id === id); if (!s) return;
      $('#priceModalService').textContent = s.name_bn + ' — বর্তমান মূল্য ' + fmtMoney(s.base_price);
      $('#priceModalInput').value = s.base_price;
      $('#priceModal').dataset.id = id;
      window.DG.openModal($('#priceModal'));
      return;
    }
    if (toggleBtn) {
      const id = toggleBtn.getAttribute('data-toggle-active');
      const s = services.find(x => x.id === id); if (!s) return;
      const { error } = await SB.client.from('services').update({ active: !s.active }).eq('id', id);
      if (error) { toast(window.STRINGS.errors.generic); return; }
      toast(s.active ? 'সেবা বন্ধ হয়েছে' : 'সেবা চালু হয়েছে');
      await load();
    }
  });

  /* ===== price modal ===== */
  $('#priceModalCancel').addEventListener('click', () => window.DG.closeModal($('#priceModal')));
  $('#priceModalSave').addEventListener('click', async () => {
    const id = $('#priceModal').dataset.id;
    const s = services.find(x => x.id === id); if (!s) return;
    const newPrice = Math.round(Number($('#priceModalInput').value));
    if (!Number.isFinite(newPrice) || newPrice < 0) { toast('সঠিক মূল্য দিন'); return; }
    if (String(newPrice) === String(s.base_price)) { window.DG.closeModal($('#priceModal')); return; }
    if (!confirm(s.name_bn + ' এর মূল্য ' + fmtMoney(s.base_price) + ' → ' + fmtMoney(newPrice) + ' করবেন?\nনতুন অর্ডারে নতুন দাম কার্যকর হবে।')) return;
    const { error } = await SB.client.from('services').update({ base_price: newPrice }).eq('id', id);
    if (error) { toast(window.STRINGS.errors.generic); return; }
    toast('মূল্য পরিবর্তিত হয়েছে');
    window.DG.closeModal($('#priceModal'));
    await load();
  });

  $('#activeChips').addEventListener('click', e => {
    const btn = e.target.closest('[data-filter]'); if (!btn) return;
    filter = btn.getAttribute('data-filter');
    document.querySelectorAll('#activeChips .chip').forEach(c => {
      const on = c.getAttribute('data-filter') === filter;
      c.classList.toggle('active', on);
      c.setAttribute('aria-selected', String(on));
    });
    render();
  });

  window.DG.trapFocus($('#priceModal'));

  (async function init () {
    if (!SB.client) { $('#servicesList').setAttribute('aria-busy', 'false'); return; }
    const { data: { session } } = await SB.client.auth.getSession();
    if (!session) { location.replace('login.html?next=admin-services.html'); return; }
    const role = await SB.requireAdmin();
    if (role !== 'admin') { $('#gate403').hidden = false; return; }
    await load();
  })();

  $('#signOutBtn').addEventListener('click', async () => {
    await SB.client.auth.signOut();
    location.href = 'login.html';
  });
})();
});
