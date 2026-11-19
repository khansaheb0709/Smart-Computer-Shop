/* সেবাঘর — shared backup builder (used by admin download + Google Drive upload).
   Exports window.ShebaghorBackup.build(): Promise<object> */
'use strict';
(function () {
  async function build() {
    if (!window.SB || !SB.client) throw new Error('no-supabase-client');
    var [oRes, iRes, pRes, evRes, ofRes, prRes, dRes] = await Promise.all([
      SB.client.from('orders').select('id, order_date, token, status, subtotal, discount, total, paid, payment_method, payment_status, pickup_slot, notes, rework, guest_name, guest_phone, customer_id, created_by, created_at, updated_at'),
      SB.client.from('order_items').select('id, order_id, service_id, name_snapshot, unit_snapshot, qty, unit_price, options'),
      SB.client.from('payments').select('id, order_id, method, amount, trx_id, status, verified_by, verified_at, note, created_at'),
      SB.client.from('order_events').select('order_id, from_status, to_status, actor, note, created_at'),
      SB.client.from('order_files').select('id, order_id, file_path, original_name, mime, size_bytes, kind, uploaded_at'),
      SB.client.from('profiles').select('id, full_name, phone, address, created_at'),
      SB.client.from('design_proofs').select('id, order_id, round, file_path, status, customer_note, sent_at, responded_at'),
    ]);
    var errs = [oRes, iRes, pRes, evRes, ofRes, prRes, dRes].filter(function (r) { return r.error; });
    if (errs.length) throw new Error(errs[0].error.message || 'backup-query-failed');
    return {
      shop: 'সেবাঘর',
      version: 2,
      exported_at: new Date().toISOString(),
      note: 'ফাইলের মূল বাইট (PDF/ছবি) নেই — কেবল মেটাডেটা। অর্ডার রিস্টোরে tools/restore-backup.sql দেখুন। সাপ্তাহিক Drive ব্যাকআপের জন্য।',
      counts: { orders: (oRes.data || []).length, order_items: (iRes.data || []).length, payments: (pRes.data || []).length,
                order_events: (evRes.data || []).length, order_files: (ofRes.data || []).length, customers: (prRes.data || []).length, proofs: (dRes.data || []).length },
      tables: { orders: oRes.data || [], order_items: iRes.data || [], payments: pRes.data || [],
                order_events: evRes.data || [], order_files: ofRes.data || [], customers: prRes.data || [], design_proofs: dRes.data || [] },
    };
  }
  window.ShebaghorBackup = { build: build };
})();
