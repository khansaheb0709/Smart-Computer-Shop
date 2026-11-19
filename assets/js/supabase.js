/* সেবাঘর — supabase.js — client factory + session + is_admin()
   Loads supabase-js UMD (CDN) lazily; degrades to a friendly setup banner when config is missing.
   Exposes: window.SB ({ client, configured, session, isAdmin, onChange, requireAdmin }) */
'use strict';
(function () {
  const cfg = window.SHEBAGHOR_CONFIG || {};
  const configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  let client = null;

  function makeClient() {
    if (!configured || !window.supabase) return null;
    return window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }

  // Admin flag: server is truth (is_admin() RPC). Cached for the page session.
  let adminCache = null;
  async function isAdmin() {
    if (!client) return false;
    if (adminCache !== null) return adminCache;
    const { data, error } = await client.rpc('is_admin');
    adminCache = !error && data === true;
    return adminCache;
  }

  async function requireAdmin() {
    const { data: { session } } = await client.auth.getSession();
    if (!session) return 'anon';
    return (await isAdmin()) ? 'admin' : 'user';
  }

  function onChange(cb) {
    if (!client) return { data: { subscription: { unsubscribe() {} } } };
    return client.auth.onAuthStateChange((_event, session) => { adminCache = null; cb(session); });
  }

  function setupBanner() {
    if (configured) return;
    const main = document.querySelector('main .container') || document.querySelector('main') || document.body;
    const div = document.createElement('div');
    div.className = 'setup-banner';
    div.setAttribute('role', 'alert');
    div.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>' +
      (window.STRINGS ? STRINGS.errors.configMissing : 'Supabase config missing') + '</span>';
    main.prepend(div);
  }

  window.SB = {
    get client() { if (!client) client = makeClient(); return client; },
    configured,
    isAdmin,
    requireAdmin,
    onChange,
    setupBanner,
  };
})();
