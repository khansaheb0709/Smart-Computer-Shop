/* সেবাঘর — admin page logic (extracted from admin.html inline <script>; DCL-guarded inside) */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
(function () {
  const { $, toast } = window.DG;
  const S = window.STRINGS.admin;
  SB.setupBanner();

  (async function init () {
    if (!SB.client) { return; }  // setup banner explains; no misleading 403 pre-config
    const { data: { session } } = await SB.client.auth.getSession();
    if (!session) { location.replace('login.html?next=admin.html'); return; }
    const role = await SB.requireAdmin();
    if (role !== 'admin') { $('#gate403').hidden = false; return; }

    $('#adminWho').textContent = 'এডমিন: ' + (session.user.email || '');
    $('#adminArea').hidden = false;

    const { data: s, error } = await SB.client.from('shop_settings').select('*').eq('id', 1).single();
    if (error) { toast(S.settingsFailed); return; }
    if (s) {
      $('#shop_name').value = s.shop_name || '';
      $('#address_bn').value = s.address_bn || '';
      $('#phone').value = s.phone || '';
      $('#opening_hours_bn').value = s.opening_hours_bn || '';
      $('#bkash_number').value = s.bkash_number || '';
      $('#bkash_name').value = s.bkash_name || '';
      $('#nagad_number').value = s.nagad_number || '';
      $('#nagad_name').value = s.nagad_name || '';
      const slots = Array.isArray(s.pickup_slots) ? s.pickup_slots : [];
      ['slot1', 'slot2', 'slot3'].forEach((id, i) => { $('#' + id).value = slots[i] || ''; });
      $('#receipt_footer_bn').value = s.receipt_footer_bn || '';
      $('#bn_digits').checked = s.bn_digits !== false;
    }
  })();

  $('#settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!SB.client) return;
    const btn = $('#saveSettingsBtn'); btn.setAttribute('aria-busy', 'true');
    const pickup_slots = [$('#slot1').value.trim(), $('#slot2').value.trim(), $('#slot3').value.trim()].filter(Boolean);
    const cleanPhone = v => v.replace(/\D/g, '') || null;
    const { error } = await SB.client.from('shop_settings').update({
      shop_name: $('#shop_name').value.trim() || 'সেবাঘর',
      address_bn: $('#address_bn').value.trim() || null,
      phone: cleanPhone($('#phone').value),
      opening_hours_bn: $('#opening_hours_bn').value.trim() || null,
      bkash_number: cleanPhone($('#bkash_number').value),
      bkash_name: $('#bkash_name').value.trim() || null,
      nagad_number: cleanPhone($('#nagad_number').value),
      nagad_name: $('#nagad_name').value.trim() || null,
      pickup_slots,
      receipt_footer_bn: $('#receipt_footer_bn').value.trim() || null,
      bn_digits: $('#bn_digits').checked,
    }).eq('id', 1);
    btn.removeAttribute('aria-busy');
    toast(error ? S.settingsFailed : S.settingsSaved);
  });

  $('#nidPurgeBtn').addEventListener('click', async () => {
    if (!SB.client) return;
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { data: files, error } = await SB.client.from('order_files')
      .select('id, file_path').eq('kind', 'nid').lt('uploaded_at', cutoff);
    if (error) { toast(window.STRINGS.errors.generic); return; }
    if (!files || !files.length) { toast('মুছার মতো পুরোনো NID ফাইল নেই'); return; }
    if (!confirm('৩০ দিনের চেয়ে পুরোনো ' + files.length + 'টি NID ফাইল স্থায়ীভাবে মুছে যাবে। নিশ্চিত?')) return;
    const paths = files.map(f => String(f.file_path).replace(/^order-files\//, ''));
    const { error: rmErr } = await SB.client.storage.from('order-files').remove(paths);
    if (rmErr) { toast('স্টোরেজ থেকে মুছতে ব্যর্থ — পরে আবার চেষ্টা করুন'); return; }
    const { error: delErr } = await SB.client.from('order_files').delete().in('id', files.map(f => f.id));
    toast(delErr ? 'ফাইল মুছেছে, রেকর্ড মুছতে ব্যর্থ — আবার চেষ্টা করুন' : files.length + 'টি NID ফাইল মুছেছে');
  });

  $('#backupBtn').addEventListener('click', async () => {
    if (!SB.client) return;
    const btn = $('#backupBtn'); btn.setAttribute('aria-busy', 'true');
    try {
      const backup = await window.ShebaghorBackup.build();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'shebaghor-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
      toast('ব্যাকআপ ডাউনলোড হয়েছে');
    } catch (err) {
      console.error(err);
      toast(window.STRINGS.errors.generic);
    }
    btn.removeAttribute('aria-busy');
  });

  $('#signOutBtn').addEventListener('click', async () => {
    if (SB.client) await SB.client.auth.signOut();
    location.href = 'login.html';
  });
})();
});
