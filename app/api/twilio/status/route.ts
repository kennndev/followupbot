import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * Twilio fires status callbacks as the call progresses:
 *   initiated -> ringing -> answered -> completed
 *
 * We use the final 'completed' event to handle no-answers / voicemails.
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const appointmentId = url.searchParams.get('appointmentId');
  if (!appointmentId) return NextResponse.json({ ok: true });

  const formData = await req.formData();
  const callStatus = formData.get('CallStatus') as string;
  const callSid = formData.get('CallSid') as string;
  const duration = parseInt((formData.get('CallDuration') as string) || '0', 10);
  const answeredBy = formData.get('AnsweredBy') as string; // 'human' | 'machine_start' | ...

  const supabase = createServerClient();

  // Log the call
  await supabase.from('call_logs').upsert(
    {
      appointment_id: appointmentId,
      twilio_call_sid: callSid,
      status: callStatus,
      duration_seconds: duration,
    },
    { onConflict: 'twilio_call_sid' }
  );

  // Handle failed / no-answer cases
  if (
    callStatus === 'no-answer' ||
    callStatus === 'busy' ||
    callStatus === 'failed' ||
    answeredBy?.startsWith('machine')
  ) {
    const { data: appt } = await supabase
      .from('appointments')
      .select('contact_attempts')
      .eq('id', appointmentId)
      .single();

    if (appt) {
      const maxAttempts = 3;
      const newStatus =
        appt.contact_attempts >= maxAttempts ? 'unreachable' : 'scheduled';
      await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointmentId);
    }
  }

  return NextResponse.json({ ok: true });
}
