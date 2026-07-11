// services/studentsService.js
import { supabase } from './supabaseClient';

// ---- masking helper (client-side display only; DB also stores masked_roll_number) ----
export function maskRoll(rollNumber, revealFull = false) {
  if (revealFull) return rollNumber;
  if (!rollNumber || rollNumber.length <= 6) return rollNumber;
  return rollNumber.slice(0, 6) + 'X'.repeat(rollNumber.length - 6);
}

// ---- reads ----
export async function fetchStudents({ includeLeft = false } = {}) {
  let query = supabase.from('students').select('*').order('roll_number');
  if (!includeLeft) query = query.eq('status', 'active');
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function searchStudents({ roll = '', mobile = '' }) {
  let query = supabase.from('students').select('*');
  if (roll) query = query.ilike('roll_number', `%${roll}%`);
  if (mobile) query = query.or(`mobile_number.ilike.%${mobile}%,father_mobile.ilike.%${mobile}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ---- writes (RLS restricts these to admins; the API call itself is identical
// for every role — Postgres enforces the permission, not the client) ----
export async function updateStudent(id, updates) {
  const { data, error } = await supabase
    .from('students')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markStudentLeft(id, left = true) {
  return updateStudent(id, { status: left ? 'left' : 'active' });
}

export async function createStudent(payload) {
  const { data, error } = await supabase.from('students').insert(payload).select().single();
  if (error) throw error;
  return data;
}

// ---- realtime ----
// Returns an unsubscribe function; call it on component unmount.
export function subscribeToStudents(onChange) {
  const channel = supabase
    .channel('students-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'students' },
      (payload) => onChange(payload)
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') console.error('students channel error', err);
      if (status === 'TIMED_OUT') {
        // simple reconnect-with-backoff
        setTimeout(() => channel.subscribe(), 2000);
      }
    });

  return () => supabase.removeChannel(channel);
}

// Generic factory so you don't repeat this per table (subjects, attendance_records,
// admins, study_materials, settings all follow the same shape):
export function subscribeToTable(table, onChange) {
  const channel = supabase
    .channel(`${table}-changes`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, onChange)
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') console.error(`${table} channel error`, err);
      if (status === 'TIMED_OUT') setTimeout(() => channel.subscribe(), 2000);
    });
  return () => supabase.removeChannel(channel);
}
