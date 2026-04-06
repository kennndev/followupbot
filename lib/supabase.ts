import { createClient } from '@supabase/supabase-js';

// Server-side client (uses service role key, bypasses RLS)
// Only use in API routes and server components.
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) {
    throw new Error('Missing Supabase server env vars');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Browser client (anon key, subject to RLS)
export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anonKey);
}

// ---- Types matching the schema ----
export type AppointmentStatus =
  | 'scheduled'
  | 'contacting'
  | 'confirmed'
  | 'rescheduled'
  | 'cancelled'
  | 'unreachable'
  | 'no_response';

export interface Doctor {
  id: string;
  name: string;
  clinic_name: string;
  phone: string;
  language: 'ur' | 'en' | 'pa';
  working_hours: {
    start: string;
    end: string;
    closed: string[];
  };
  created_at: string;
}

export interface Patient {
  id: string;
  doctor_id: string;
  name: string;
  phone: string;
  preferred_language: string;
  created_at: string;
}

export interface Appointment {
  id: string;
  doctor_id: string;
  patient_id: string;
  scheduled_for: string;
  reason: string | null;
  status: AppointmentStatus;
  contact_attempts: number;
  last_contact_at: string | null;
  rescheduled_to: string | null;
  patient_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExtractedPatientData {
  patient_name: string | null;
  phone_number: string | null;     // +92XXXXXXXXXX
  followup_date: string | null;    // ISO date
  followup_time: string | null;    // HH:MM 24h
  followup_reason: string | null;
  missing_fields: string[];
  clarifying_question: string | null;
  language_detected: 'ur' | 'en' | 'pa' | 'mixed';
}
