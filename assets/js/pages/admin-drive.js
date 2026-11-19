/* সেবাঘর — Google Drive backup/restore (appDataFolder; GIS token client).
   Restore is intentionally DOWNLOAD-ONLY: the real restore wipes the orders family
   and must be run deliberately via tools/restore-backup.sql (see docs/07_Runbook). */
'use strict';
document.addEventListener('DOMContentLoaded', function () {
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { var d = document.createElement('div'); d.textContent = String(s == null ? '' : s); return d.innerHTML; };
  var SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  var token = null, clientId = '';
  var bnDigits = function (s) { return String(s).replace(/[0-9]/g, function (d) { return '০১২৩৪৫৬৭৮৯'[+d]; }); };

  function getClientId () {
    return localStorage.getItem('shebaghor_google_client_id') || (window.SHEBAGHOR_CONFIG && window.SHEBAGHOR_CONFIG.GOOGLE_DRIVE_CLIENT_ID) || '';
  }
  function setStatus (t, isErr) { var el = $('#driveStatus'); el.textContent = t; el.style.color = isErr ? 'var(--danger)' : 'var(--green)'; }
  function fmtSize (b) { b = +b || 0; return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }

  /* ---------- client id UX ---------- */
  function refreshClientIdUi () {
    clientId = getClientId();
    $('#driveClientIdInput').value = localStorage.getItem('shebaghor_google_client_id') || '';
    $('#driveSetupBox').hidden = !!clientId;
    $('#driveReadyBox').hidden = !clientId;
  }
  $('#saveDriveClientIdBtn').addEventListener('click', function () {
    var v = $('#driveClientIdInput').value.trim();
    if (!/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(v)) { alert('Client ID দেখতে এরকম হবে: 1234567890-abc….apps.googleusercontent.com'); return; }
    localStorage.setItem('shebaghor_google_client_id', v);
    refreshClientIdUi();
    setStatus('Client ID সেভ হয়েছে — এখন "ড্রাইভে সংযুক্ত করুন" চাপুন।');
  });

  /* ---------- auth ---------- */
  function ensureGis () {
    return new Promise(function (resolve, reject) {
      if (window.google && google.accounts && google.accounts.oauth2) return resolve();
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = resolve; s.onerror = function () { reject(new Error('Google স্ক্রিপ্ট লোড হয়নি — ইন্টারনেট সংযোগ দেখুন।')); };
      document.head.appendChild(s);
    });
  }
  async function connect () {
    clientId = getClientId();
    if (!clientId) { $('#driveSetupBox').hidden = false; return null; }
    await ensureGis();
    return new Promise(function (resolve, reject) {
      var client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: function (resp) {
          if (resp && resp.access_token) { token = resp.access_token; resolve(token); }
          else reject(new Error('অনুমতি পাওয়া যায়নি।'));
        },
        error_callback: function (err) { reject(new Error(err && err.message ? err.message : 'সাইন-ইন বাতিল হয়েছে।')); }
      });
      client.requestAccessToken();
    });
  }
  $('#driveConnectBtn').addEventListener('click', async function () {
    try { await connect(); setStatus('ড্রাইভের সাথে সংযুক্ত ✔'); refreshList(); }
    catch (e) { setStatus(e.message, true); }
  });

  /* ---------- API helpers ---------- */
  async function api (path, options) {
    if (!token) await connect();
    var res = await fetch('https://www.googleapis.com' + path, Object.assign({
      headers: Object.assign({ Authorization: 'Bearer ' + token }, (options && options.headers) || {})
    }, options || {}));
    if (res.status === 401) { token = null; throw new Error('সেশন শেষ — আবার সংযুক্ত করুন।'); }
    if (!res.ok) {
      var body = await res.text().catch(function () { return ''; });
      throw new Error('Drive API ত্রুটি (' + res.status + '): ' + body.slice(0, 200));
    }
    return res;
  }
  async function listBackups () {
    var q = encodeURIComponent("name contains 'shebaghor-backup' and trashed = false");
    var res = await api('/drive/v3/files?spaces=appDataFolder&q=' + q + '&orderBy=createdTime%20desc&pageSize=50&fields=files(id,name,size,createdTime)');
    var data = await res.json();
    return data.files || [];
  }
  async function refreshList () {
    var box = $('#driveBackupList');
    box.innerHTML = '<p class="muted">লোড হচ্ছে…</p>';
    try {
      var files = await listBackups();
      if (!files.length) { box.innerHTML = '<p class="muted">ড্রাইভে এখনো কোনো ব্যাকআপ নেই।</p>'; return; }
      box.innerHTML = '';
      files.forEach(function (f, i) {
        var row = document.createElement('div');
        row.className = 'cv-row';
        row.style.cssText = 'border-bottom:1px solid var(--line);padding:6px 0;align-items:center';
        row.innerHTML = '<span><b>' + esc(f.name) + '</b><br><span class="hint">' + fmtSize(f.size) + ' · ' + esc((f.createdTime || '').slice(0, 16).replace('T', ' ')) + (i === 0 ? ' · সর্বশেষ' : '') + '</span></span>' +
          '<span><button class="btn btn-ghost btn-small" data-dl>⬇️ আনুন</button> <button class="btn btn-ghost btn-small" data-tr style="color:var(--danger)">🗑️</button></span>';
        row.querySelector('[data-dl]').addEventListener('click', function () { downloadBackup(f); });
        row.querySelector('[data-tr]').addEventListener('click', function () { trashBackup(f); });
        box.appendChild(row);
      });
    } catch (e) { box.innerHTML = '<p class="muted">তালিকা আনা যায়নি: ' + esc(e.message) + '</p>'; }
  }
  async function downloadBackup (f) {
    try {
      var res = await api('/drive/v3/files/' + encodeURIComponent(f.id) + '?alt=media');
      var blob = await res.blob();
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = f.name || 'shebaghor-backup.json'; a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
      setStatus('ব্যাকআপ ডাউনলোড হয়েছে। রিস্টোর করতে: psql … -f tools/restore-backup.sql (docs/07_Runbook দেখুন)।');
    } catch (e) { setStatus(e.message, true); }
  }
  async function trashBackup (f) {
    if (!confirm('"' + f.name + '" ড্রাইভের ট্র্যাশে যাবে। নিশ্চিত?')) return;
    try { await api('/drive/v3/files/' + encodeURIComponent(f.id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) }); setStatus('ট্র্যাশে পাঠানো হয়েছে।'); refreshList(); }
    catch (e) { setStatus(e.message, true); }
  }

  /* ---------- upload ---------- */
  $('#driveBackupBtn').addEventListener('click', async function () {
    var btn = $('#driveBackupBtn'); btn.setAttribute('aria-busy', 'true');
    setStatus('ব্যাকআপ তৈরি হচ্ছে…');
    try {
      await connect();
      var backup = await window.ShebaghorBackup.build();
      var json = JSON.stringify(backup, null, 2);
      var now = new Date();
      var stamp = now.toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
      var name = 'shebaghor-backup-' + stamp + '.json';
      var boundary = 'shebaghor-' + Math.random().toString(36).slice(2);
      var metadata = { name: name, parents: ['appDataFolder'], mimeType: 'application/json' };
      var body = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + '\r\n' +
        '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + json + '\r\n--' + boundary + '--';
      var res = await api('/upload/drive/v3/files?uploadType=multipart&fields=id,name,createdTime', {
        method: 'POST',
        headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
        body: body
      });
      var data = await res.json();
      setStatus('✅ ড্রাইভে আপলোড হয়েছে: ' + data.name);
      refreshList();
    } catch (e) {
      console.error(e); setStatus(e.message, true);
    }
    btn.removeAttribute('aria-busy');
  });
  $('#driveRefreshBtn').addEventListener('click', async function () { try { await connect(); refreshList(); setStatus('তালিকা হালনাগাদ হয়েছে।'); } catch (e) { setStatus(e.message, true); } });
  /* keep newest 3, trash the rest — ONLY after explicit click + confirm (never automatic) */
  $('#driveCleanupBtn').addEventListener('click', async function () {
    try {
      await connect();
      var files = await listBackups();
      var old = files.slice(3);
      if (!old.length) { setStatus('৩টির বেশি পুরোনো ব্যাকআপ নেই।'); return; }
      if (!confirm('সর্বশেষ ৩টি রেখে বাকি ' + bnDigits(old.length) + 'টি ব্যাকআপ ট্র্যাশে যাবে। নিশ্চিত?')) return;
      for (var i = 0; i < old.length; i++) {
        await api('/drive/v3/files/' + encodeURIComponent(old[i].id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
      }
      setStatus(bnDigits(old.length) + 'টি পুরোনো ব্যাকআপ ট্র্যাশে পাঠানো হয়েছে।'); refreshList();
    } catch (e) { setStatus(e.message, true); }
  });

  refreshClientIdUi();
});
