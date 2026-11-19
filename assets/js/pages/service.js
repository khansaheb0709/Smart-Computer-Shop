/* সেবাঘর — service page logic (extracted from service.html inline <script>; DCL-guarded inside) */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
(function () {
  const { $, $$, esc, fmtMoney, toBnDigits, toast, PHONE_RE } = window.DG;
  const slug = new URLSearchParams(location.search).get('slug') || '';
  let service = null;

  SB.setupBanner();

  const optionsForm = $('#optionsForm');
  const qtyInput = $('#qtyInput');

  function currentQty() { return Math.max(1, Math.min(9999, parseInt(qtyInput.value, 10) || 1)); }
  function selectedOptions() {
    const opts = {};
    $$('select, input', optionsForm).forEach(el => { if (el.name) opts[el.name] = el.value; });
    return opts;
  }
  function refreshTotal() {
    if (!service) return;
    $('#lineTotal').textContent = fmtMoney(currentQty() * service.base_price);
  }

  function renderOptions(s) {
    const schema = s.options_schema;
    const entries = schema && typeof schema === 'object' ? Object.entries(schema) : [];
    if (!entries.length) { optionsForm.innerHTML = '<p class="small muted" style="margin:0">এই সেবার জন্য কোনো অপশন বাছাই করতে হবে না — সরাসরি অর্ডারে যোগ করুন।</p>'; return; }
    optionsForm.innerHTML = entries.map(([key, choices]) => {
      const id = 'opt_' + key;
      const opts = (Array.isArray(choices) ? choices : []).map(c => '<option value="' + esc(String(c)) + '">' + esc(String(c)) + '</option>').join('');
      return '<div class="field"><label for="' + esc(id) + '">' + esc(key) + '</label><select class="control" id="' + esc(id) + '" name="' + esc(key) + '">' + opts + '</select></div>';
    }).join('');
    optionsForm.addEventListener('change', refreshTotal);
  }

  (async function load() {
    if (!SB.client) { $('#detailLoading').hidden = true; $('#detailError').hidden = false;
      $('#detailError').querySelector('p').textContent = 'Supabase কনফিগার করা হয়নি — docs/05_Schema.md দেখুন'; return; }
    const { data, error } = await SB.client.from('services')
      .select('id, slug, name_bn, description_bn, category, unit_bn, base_price, requires_file, eta_bn, options_schema')
      .eq('slug', slug).eq('active', true).single();
    $('#detailLoading').hidden = true;
    if (error || !data) { $('#detailError').hidden = false; return; }
    service = data;
    $('#svcCategory').textContent = window.CATALOG.CATEGORY_BN[data.category] || data.category;
    $('#svcName').textContent = data.name_bn;
    $('#svcDesc').textContent = data.description_bn || '';
    $('#svcEta').textContent = data.eta_bn ? ('আনুমানিক সময়: ' + data.eta_bn) : '';
    $('#svcUnit').textContent = data.unit_bn;
    $('#fileNeededNote').hidden = !data.requires_file;
    document.title = data.name_bn + ' — সেবাঘর';
    renderOptions(data);
    refreshTotal();
    $('#detailArea').hidden = false;
  })();

  qtyInput.addEventListener('input', refreshTotal);
  $('#qtyMinus').addEventListener('click', () => { qtyInput.value = Math.max(1, currentQty() - 1); refreshTotal(); });
  $('#qtyPlus').addEventListener('click', () => { qtyInput.value = Math.min(9999, currentQty() + 1); refreshTotal(); });

  $('#addToOrderBtn').addEventListener('click', () => {
    if (!service) return;
    const d = window.CATALOG.getDraft();
    d.items.push({
      service_id: service.id, slug: service.slug, name_bn: service.name_bn, unit_bn: service.unit_bn,
      unit_price: service.base_price, qty: currentQty(), options: selectedOptions(), requires_file: !!service.requires_file,
    });
    window.CATALOG.saveDraft(d);
    toast('অর্ডারে যোগ হয়েছে: ' + service.name_bn);
    setTimeout(() => { location.href = 'order.html#step2'; }, 450);
  });
})();
});
