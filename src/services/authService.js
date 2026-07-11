// services/authService.js
//
// Design note on the roll-number + DOB login flow:
// Supabase Auth needs a real credential (email/password, magic link, OAuth, or OTP).
// "Roll number + DOB" is a *lookup key*, not a secret good enough to hand to
// supabase.auth.signInWithPassword() directly. The safe pattern is:
//
//   1. Each admin/student is provisioned in Supabase Auth with a synthetic email
//      (e.g. `255113442@bca-d-class.internal`) and a real random password set
//      at provisioning time (never the literal DOB).
//   2. A Postgres Edge Function (`verify-login`) checks roll_number + date_of_birth
//      against the `students` table server-side, and if it matches, calls
//      `supabase.auth.admin.generateLink` (or exchanges a custom token) to
//      establish a session — the DOB itself is never used as the Auth password.
//
// This keeps "banking-grade" auth (real JWTs, refresh tokens, RLS-aware
// sessions) while preserving the roll-number/DOB UX the app already has.
// Below is the client-side service that talks to that Edge Function.

import { supabase } from './supabaseClient';

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export async function loginWithRollAndDob(rollNumber, dob) {
  const res = await fetch(`${FUNCTIONS_URL}/verify-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roll_number: rollNumber, date_of_birth: dob }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Invalid roll number or date of birth');
  }

  const { access_token, refresh_token } = await res.json();

  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  if (error) throw error;
  return data.session;
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function isCurrentUserAdmin() {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) return false;
  return !!data;
}

export function onAuthStateChange(callback) {
  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => sub.subscription.unsubscribe();
}

// Record a device/session fingerprint for the "device session tracking" requirement.
export async function trackDeviceSession(userId) {
  const deviceInfo = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
  };
  await supabase.from('user_sessions').insert({
    user_id: userId,
    device_info: deviceInfo,
  });
}
