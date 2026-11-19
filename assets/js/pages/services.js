/* সেবাঘর — services page logic (extracted from services.html inline <script>; DCL-guarded inside) */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
(function () {
  const { $, $$, esc } = window.DG;
  const grid = $('#catalogGrid'), emptyEl = $('#catalogEmpty'), errEl = $('#catalogError');
  let all = [], activeCat = '', query = '', sortMode = 'popular', popularity = null;

  SB.setupBanner();
  (async () => {
    if (!SB.client) return;
    const { data: { session } } = await SB.client.auth.getSession();
    if (session) { const a = $('#accountLink'); a.textContent = 'আমার অ্যাকাউন্ট'; a.href = 'account.html'; }
  })();

  function skeletons(n) {
    return Array.from({ length: n }, () => '<div class="skeleton" style="height:150px"></div>').join('');
  }

  function render() {
    const q = query.trim();
    let list = all.filter(s => (!activeCat || s.category === activeCat) && window.CATALOG.matchSearch(s, q));
    list = window.CATALOG.sortServices(list, sortMode, popularity);
    grid.setAttribute('aria-busy', 'false');
    if (!list.length) {
      grid.innerHTML = '';
      emptyEl.hidden = false; errEl.hidden = true;
      return;
    }
    emptyEl.hidden = true; errEl.hidden = true;
    grid.innerHTML = list.map(window.CATALOG.serviceCardHTML).join('');
  }

  function renderChips() {
    const cats = [...new Set(all.map(s => s.category))];
    const order = ['print','photocopy','scan','typing','photo','online','design','deed','other'].filter(c => cats.includes(c));
    $('#categoryChips').innerHTML =
      '<button class="chip' + (activeCat === '' ? ' active' : '') + '" role="tab" data-cat="">সব <span class="count">' + all.length + '</span></button>' +
      order.map(c => '<button class="chip' + (activeCat === c ? ' active' : '') + '" role="tab" data-cat="' + esc(c) + '">' + esc(window.CATALOG.CATEGORY_BN[c] || c) + ' <span class="count">' + all.filter(s => s.category === c).length + '</span></button>').join('');
  }

  async function load() {
    grid.setAttribute('aria-busy', 'true');
    grid.innerHTML = skeletons(8);
    errEl.hidden = true;
    const { data, error } = await window.CATALOG.fetchServices();
    if (error || !data) {
      grid.innerHTML = ''; errEl.hidden = false; return;
    }
    all = data;
    popularity = await window.CATALOG.fetchPopularity();
    renderChips();
    render();
  }

  $('#searchBox').addEventListener('input', e => { query = e.target.value; render(); });
  $('#sortSelect').addEventListener('change', e => { sortMode = e.target.value; render(); });
  $('#categoryChips').addEventListener('click', e => {
    const btn = e.target.closest('[data-cat]'); if (!btn) return;
    activeCat = btn.getAttribute('data-cat');
    renderChips(); render();
  });
  $('#clearSearchBtn').addEventListener('click', () => { query = ''; activeCat = ''; $('#searchBox').value = ''; renderChips(); render(); });
  $('#retryBtn').addEventListener('click', load);

  load();
})();
});
