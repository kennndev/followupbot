import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { normalizePakistaniPhone, isValidPakistaniMobile } from '@/lib/phone';

export async function POST(req: NextRequest) {
  const doctorId = req.cookies.get('ds')?.value;
  if (!doctorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, phone, date, time, reason, diagnosis, medications } = await req.json();

  if (!name || !phone || !date || !reason) {
    return NextResponse.json({ error: 'Name, phone, date and reason are required' }, { status: 400 });
  }

  const normalizedPhone = normalizePakistaniPhone(phone);
  if (!isValidPakistaniMobile(normalizedPhone)) {
    return NextResponse.json({ error: 'Invalid Pakistani phone number' }, { status: 400 });
  }

  const supabase = createServerClient();

  // Find or create patient
  const { data: existing } = await supabase
    .from('patients')
    .select('id')
    .eq('doctor_id', doctorId)
    .eq('phone', normalizedPhone)
    .maybeSingle();

  let patientId: string;

  if (existing) {
    patientId = existing.id;
    if (diagnosis || medications) {
      await supabase
        .from('patients')
        .update({
          ...(diagnosis && { diagnosis }),
          ...(medications && { medications }),
        })
        .eq('id', patientId);
    }
  } else {
    const { data: newPatient, error } = await supabase
      .from('patients')
      .insert({
        doctor_id: doctorId,
        name,
        phone: normalizedPhone,
        preferred_language: 'ur',
        diagnosis: diagnosis || null,
        medications: medications || null,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    patientId = newPatient.id;
  }

  const scheduledFor = new Date(`${date}T${time || '16:00'}:00+05:00`);
  const { data: appt, error: apptErr } = await supabase
    .from('appointments')
    .insert({
      doctor_id: doctorId,
      patient_id: patientId,
      scheduled_for: scheduledFor.toISOString(),
      reason,
      status: 'scheduled',
    })
    .select()
    .single();

  if (apptErr) return NextResponse.json({ error: apptErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, appointmentId: appt.id });
}
