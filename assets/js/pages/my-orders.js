/* সেবাঘর — my-orders page logic (extracted from my-orders.html inline <script>; DCL-guarded inside) */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
(function () {
  const { $, $$, esc, fmtMoney, toBnDigits, toast } = window.DG;
  const S = window.STRINGS.status, M = window.STRINGS.myOrders;
  SB.setupBanner();

  (async function init () {
    if (!SB.client) { $('#ordersLoading').hidden = true; $('#ordersEmpty').hidden = false;
      $('#ordersEmpty').querySelector('p').textContent = 'Supabase কনফিগার করা হয়নি — docs/05_Schema.md দেখুন';
      $('#ordersEmpty').querySelector('a').style.display = 'none'; return; }
    const { data: { session } } = await SB.client.auth.getSession();
    if (!session) { location.replace('login.html?next=my-orders.html'); return; }

    const { data: orders, error } = await SB.client
      .from('orders')
      .select('id, order_date, token, status, total, paid, due, payment_status, payment_method, pickup_slot, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    $('#ordersLoading').hidden = true;
    if (error) { toast(window.STRINGS.errors.generic); return; }
    if (!orders || !orders.length) { $('#ordersEmpty').hidden = false; return; }

    const list = $('#ordersList');
    list.setAttribute('aria-busy', 'false');
    list.innerHTML = orders.map(o =>
      '<div>' +
        '<button class="order-row" type="button" data-id="' + esc(o.id) + '" aria-expanded="false">' +
          '<span><span class="small muted">' + esc(new Date(o.order_date).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' })) + '</span><br>' +
            '<strong>' + toBnDigits('টি-' + String(o.token).padStart(3, '0')) + '</strong></span>' +
          '<span class="badge" data-status="' + esc(o.status) + '">' + esc(S[o.status] || o.status) + '</span>' +
          '<span class="num"><strong>' + fmtMoney(o.total) + '</strong>' + (o.due > 0 ? '<br><span class="badge-due badge" style="font-size:10px">বাকি ' + fmtMoney(o.due) + '</span>' : '') + '</span>' +
        '</button>' +
        '<div class="order-detail-panel" id="detail-' + esc(o.id) + '" hidden></div>' +
      '</div>'
    ).join('');

    list.addEventListener('click', async (e) => {
      const btn = e.target.closest('.order-row'); if (!btn) return;
      const id = btn.getAttribute('data-id');
      const panel = $('#detail-' + CSS.escape(id));
      const open = !panel.hidden;
      if (open) { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); return; }
      panel.hidden = false; btn.setAttribute('aria-expanded', 'true');
      panel.innerHTML = '<div class="skeleton" style="height:80px"></div>';
      await renderDetail(panel, id);
    });
  })();

  async function renderDetail(panel, orderId) {
    const { data: items } = await SB.client.from('order_items')
      .select('name_snapshot, unit_snapshot, qty, unit_price, line_total, options').eq('order_id', orderId);
    const { data: proofs } = await SB.client.from('design_proofs')
      .select('id, round, file_path, status, customer_note').eq('order_id', orderId).order('round', { ascending: true });

    const rows = (items || []).map(it =>
      '<tr><td>' + esc(it.name_snapshot) + '</td><td>' + esc(String(it.qty)) + ' ' + esc(it.unit_snapshot) + '</td><td class="num">' + fmtMoney(it.line_total) + '</td></tr>'
    ).join('');

    let proofHtml = '';
    if (proofs && proofs.length) {
      const latest = proofs[proofs.length - 1];
      let url = '';
      const { data: signed } = await SB.client.storage.from('proofs').createSignedUrl(String(latest.file_path).replace(/^proofs\//, ''), 60);
      if (signed) url = signed.signedUrl;
      proofHtml =
        '<div style="margin-top:12px; border-top:1px dashed var(--line); padding-top:12px">' +
          '<h3>ডিজাইন প্রমাণ (রাউন্ড ' + esc(String(latest.round)) + ')</h3>' +
          (url ? (latest.file_path.match(/\.(pdf)$/i)
            ? '<a class="btn btn-ghost btn-small" href="' + esc(url) + '" target="_blank" rel="noopener" style="margin-top:8px">প্রমাণ ডাউনলোড (PDF)</a>'
            : '<img src="' + esc(url) + '" alt="ডিজাইন প্রমাণ রাউন্ড ' + esc(String(latest.round)) + '" style="max-width:100%; max-height:260px; object-fit:contain; border-radius:8px; border:1px solid var(--border); margin-top:8px" loading="lazy">') : '') +
          (latest.round > 3 ? '<p class="small" style="background:var(--amber-soft); border:1px solid var(--amber); border-radius:8px; padding:6px 10px; margin-top:8px; font-weight:600; color:var(--amber)">রাউন্ড ' + esc(String(latest.round)) + ' — অতিরিক্ত সংশোধন চার্জ প্রযোজ্য হতে পারে। দোকানকে জিজ্ঞাসা করুন।</p>' : '') +
          (latest.status === 'sent'
            ? '<div class="row" style="margin-top:12px"><button class="btn btn-primary btn-small" data-proof-act="approved" data-proof="' + esc(latest.id) + '">অনুমোদন করি</button><button class="btn btn-ghost btn-small" data-proof-act="changes_requested" data-proof="' + esc(latest.id) + '">পরিবর্তন চাই</button></div><textarea class="control" id="proofNote-' + esc(latest.id) + '" rows="2" placeholder="কী পরিবর্তন চান?" style="margin-top:8px"></textarea>'
            : '<p class="small muted" style="margin-top:8px">আপনার প্রতিক্রিয়া: ' + esc(latest.status === 'approved' ? M.proofApprovedTxt : M.proofChangesTxt) + '</p>') +
        '</div>';
    }

    panel.innerHTML =
      '<div class="table-wrap"><table class="table"><thead><tr><th>সেবা</th><th>পরিমাণ</th><th class="num">মোট</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      proofHtml +
      '<div class="row" style="margin-top:12px"><button class="btn btn-ghost btn-small" data-reorder="' + esc(orderId) + '">আবার অর্ডার করুন</button></div>';

    panel.addEventListener('click', async e => {
      const reorderBtn = e.target.closest('[data-reorder]');
      const proofBtn = e.target.closest('[data-proof-act]');
      if (reorderBtn) {
        const { data: its } = await SB.client.from('order_items')
          .select('service_id, qty, options').eq('order_id', reorderBtn.getAttribute('data-reorder'));
        for (const it of (its || [])) {
          if (it.service_id) await window.CATALOG.addToDraft(it.service_id, it.qty, it.options || {});
        }
        toast('অর্ডার ড্রাফটে সেবাগুলো যোগ হয়েছে — দাম নতুনটায় ক্যালকুলেট হবে');
        setTimeout(() => { location.href = 'order.html#step1'; }, 500);
        return;
      }
      if (proofBtn) {
        const proofId = proofBtn.getAttribute('data-proof');
        const act = proofBtn.getAttribute('data-proof-act');
        const note = (panel.querySelector('#proofNote-' + CSS.escape(proofId)) || {}).value?.trim() || null;
        const { error } = await SB.client.from('design_proofs')
          .update({ status: act, customer_note: note, responded_at: new Date().toISOString() })
          .eq('id', proofId);
        toast(error ? M.proofSaveFailed : M.proofSent);
        if (!error) { panel.hidden = true; panel.innerHTML = ''; }
      }
    }, { once: false });
  }

  $('#signOutBtn').addEventListener('click', async () => {
    await SB.client.auth.signOut();
    location.href = 'login.html';
  });
})();
});
