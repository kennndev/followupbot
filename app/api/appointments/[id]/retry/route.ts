import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { initiateCall } from '@/lib/twilio';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const { data: appt } = await supabase
    .from('appointments')
    .select('*, patients(phone, name)')
    .eq('id', params.id)
    .single();

  if (!appt) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });

  // Reset status so the call goes through
  await supabase
    .from('appointments')
    .update({ status: 'scheduled' })
    .eq('id', params.id);

  // @ts-ignore
  const phone = appt.patients.phone;
  const sid = await initiateCall({ to: phone, appointmentId: params.id });
  return NextResponse.json({ ok: true, callSid: sid });
}
