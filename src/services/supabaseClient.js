// services/supabaseClient.js
// Single shared Supabase client for the whole app.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase env vars: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'bca-d-class-auth',
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

// ---------------------------------------------------------------------------
// Auto-logout on inactivity (banking-grade session hygiene).
// Call `initInactivityLogout()` once from your root component.
// ---------------------------------------------------------------------------
const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutes
let inactivityTimer = null;

export function initInactivityLogout(onLogout) {
  const resetTimer = () => {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(async () => {
      await supabase.auth.signOut();
      if (onLogout) onLogout();
    }, INACTIVITY_LIMIT_MS);
  };

  ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach((evt) =>
    window.addEventListener(evt, resetTimer, { passive: true })
  );
  resetTimer();

  return () => {
    clearTimeout(inactivityTimer);
    ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach((evt) =>
      window.removeEventListener(evt, resetTimer)
    );
  };
}
