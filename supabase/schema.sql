-- =============================================================================
-- FollowUp Bot — Supabase Schema
-- Run this in the Supabase SQL Editor for your project
-- =============================================================================

-- Doctors / clinics
create table if not exists doctors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  clinic_name text not null,
  phone text not null unique,           -- WhatsApp number used to send voice notes
  language text not null default 'ur',  -- 'ur' | 'en' | 'pa'
  working_hours jsonb default '{"start":"09:00","end":"21:00","closed":["sunday"]}'::jsonb,
  created_at timestamptz not null default now()
);

-- Patients (scoped per doctor)
create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctors(id) on delete cascade,
  name text not null,
  phone text not null,                  -- normalized: +92XXXXXXXXXX
  preferred_language text default 'ur', -- inherited from doctor unless overridden
  created_at timestamptz not null default now(),
  unique (doctor_id, phone)
);

-- Scheduled follow-up appointments
create type appointment_status as enum (
  'scheduled',     -- created, not yet called
  'contacting',    -- call in progress
  'confirmed',     -- patient said yes
  'rescheduled',   -- patient picked a new slot
  'cancelled',     -- patient said no follow-up needed
  'unreachable',   -- 3 attempts, no answer
  'no_response'    -- patient picked up but gave unclear answer
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctors(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  scheduled_for timestamptz not null,   -- original follow-up date/time
  reason text,                          -- "BP review", "post-MI check", etc.
  status appointment_status not null default 'scheduled',
  contact_attempts int not null default 0,
  last_contact_at timestamptz,
  rescheduled_to timestamptz,           -- if patient picked new time
  patient_notes text,                   -- why they can't come, any concerns
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_appointments_doctor on appointments(doctor_id);
create index if not exists idx_appointments_status on appointments(status);
create index if not exists idx_appointments_scheduled on appointments(scheduled_for);

-- Call logs (every Twilio interaction)
create table if not exists call_logs (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  twilio_call_sid text,
  direction text default 'outbound',
  status text,                          -- twilio call status
  duration_seconds int,
  transcript jsonb,                     -- full conversation turns
  outcome text,                         -- 'confirmed' | 'rescheduled' | 'cancelled' | 'no_answer' | 'unclear'
  recording_url text,
  created_at timestamptz not null default now()
);

-- Enrollment logs (every voice note the doctor sends)
create table if not exists enrollments (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctors(id) on delete cascade,
  raw_transcript text,                  -- what Whisper heard
  extracted_data jsonb,                 -- what Claude extracted
  status text not null default 'pending', -- 'pending' | 'confirmed' | 'cancelled' | 'needs_clarification'
  appointment_id uuid references appointments(id) on delete set null,
  whatsapp_message_id text,
  created_at timestamptz not null default now()
);

-- Auto-update updated_at on appointments
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists appointments_updated_at on appointments;
create trigger appointments_updated_at
  before update on appointments
  for each row execute function update_updated_at();

-- =============================================================================
-- Seed data for local testing (DELETE BEFORE PRODUCTION)
-- =============================================================================
insert into doctors (name, clinic_name, phone, language)
values ('Dr. Ahmed', 'Ahmed Cardiology Clinic', '+923001234567', 'ur')
on conflict (phone) do nothing;
