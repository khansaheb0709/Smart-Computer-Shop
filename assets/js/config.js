/* সেবাঘর — config.js — public runtime config (ANON key is safe BY DESIGN; RLS protects data)
   NEVER put the service-role key here. Prod project: "Smart Shop" (ap-southeast-2). */
window.SHEBAGHOR_CONFIG = {
  SUPABASE_URL: 'https://ewceannqfwylnicftmgo.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y2Vhbm5xZnd5bG5pY2Z0bWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ4MTA3NjIsImV4cCI6MjExMDM4Njc2Mn0.RHci9QKHJjJ7n0Y9iFO2nit0MmhaZ1I75Zc5ysozQOI',
  // Google Drive backup (public OAuth Client ID — NOT a secret; restrict by Authorized JavaScript origins in Google Cloud Console).
  // Leave '' until you paste your own from console.cloud.google.com → APIs & Services → Credentials.
  // You may also paste it once in এডমিন → সেটিংস (stored only in this browser's localStorage).
  GOOGLE_DRIVE_CLIENT_ID: '',
};
