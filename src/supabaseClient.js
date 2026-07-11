import { createClient } from '@supabase/supabase-js';

// Put these in a .env file at your project root as:
// VITE_SUPABASE_URL=https://xxxx.supabase.co
// VITE_SUPABASE_ANON_KEY=sb_publishable_xxxx
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://wjkxnnnlxdhwcmscxjrf.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indqa3hubm5seGRod2Ntc2N4anJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzOTMyNDksImV4cCI6MjA5ODk2OTI0OX0.Pa_zaUK_pXDNXGDTocsn7faGMpdACCclhDdbfuQy23g';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/*
==================================================================================
REQUIRED SUPABASE SCHEMA (run in Supabase SQL editor)
==================================================================================

create table if not exists subjects (
  id bigint generated always as identity primary key,
  name text not null unique
);

create table if not exists admins (
  "rollNo" text primary key,
  dob text not null
);

create table if not exists study_materials (
  id bigint generated always as identity primary key,
  subject_name text not null,
  file_name text not null,
  file_url text not null,
  created_at timestamptz default now()
);
-- storage bucket: "materials" (public read)

create table if not exists left_students (
  roll_no text primary key,
  marked_at timestamptz default now()
);

create table if not exists timetable (
  id bigint generated always as identity primary key,
  day_order int not null,       -- 1..6
  hour int not null,            -- 1..5
  subject_name text default '',
  unique(day_order, hour)
);

create table if not exists app_settings (
  key text primary key,
  value text
);
-- seed: insert into app_settings (key,value) values ('current_day_order','1');
-- seed: insert into app_settings (key,value) values ('class_name','2 B.C.A. D');

create table if not exists attendance_history (
  id bigint generated always as identity primary key,
  date date not null,
  hour int,
  subject_name text,
  class_name text,
  absent_rolls text[] default '{}',
  total_enrolled int,
  total_left int,
  total_active int,
  total_absent int,
  total_present int,
  message text,
  saved_at timestamptz default now()
);

create table if not exists semester_results (
  id bigint generated always as identity primary key,
  roll_no text not null,
  semester int not null,
  subject_name text not null,
  marks numeric,
  max_marks numeric default 100,
  created_at timestamptz default now()
);

Enable Row Level Security + permissive policies as needed for your use case
(this app uses the anon key directly, so keep policies scoped appropriately).
==================================================================================
*/