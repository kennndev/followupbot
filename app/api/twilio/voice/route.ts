import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { createServerClient } from '@/lib/supabase';
import { buildOpeningLine, CallContext } from '@/lib/conversation';

/**
 * Initial TwiML returned when the patient picks up.
 * Plays the opening line, then gathers their speech and forwards to /response.
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const appointmentId = url.searchParams.get('appointmentId');
  if (!appointmentId) {
    return new NextResponse('Missing appointmentId', { status: 400 });
  }

  const supabase = createServerClient();
  const { data: appt } = await supabase
    .from('appointments')
    .select('*, patients(*), doctors(*)')
    .eq('id', appointmentId)
    .single();

  if (!appt) {
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say('Sorry, appointment not found.');
    twiml.hangup();
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  // Mark as contacting
  await supabase
    .from('appointments')
    .update({
      status: 'contacting',
      contact_attempts: appt.contact_attempts + 1,
      last_contact_at: new Date().toISOString(),
    })
    .eq('id', appointmentId);

  const ctx: CallContext = {
    patient_name: appt.patients.name,
    doctor_name: appt.doctors.name,
    clinic_name: appt.doctors.clinic_name,
    appointment_date: new Date(appt.scheduled_for).toLocaleDateString('en-PK', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }),
    appointment_reason: appt.reason || 'follow-up',
    language: appt.patients.preferred_language || 'ur',
  };

  const opening = buildOpeningLine(ctx);

  const twiml = new twilio.twiml.VoiceResponse();

  // Twilio's built-in Urdu voice via <Say language="ur-PK">
  // For higher quality, replace with <Play> of a pre-generated ElevenLabs audio URL
  const gather = twiml.gather({
    input: ['speech'],
    language: ctx.language === 'ur' ? 'ur-PK' : 'en-IN',
    speechTimeout: 'auto',
    action: `/api/twilio/response?appointmentId=${appointmentId}&state=greeting`,
    method: 'POST',
  });

  gather.say(
    { language: ctx.language === 'ur' ? 'ur-PK' : 'en-IN', voice: 'Polly.Aditi' },
    opening
  );

  // If no speech detected, hang up (status callback will record as no_answer)
  twiml.say(
    { language: ctx.language === 'ur' ? 'ur-PK' : 'en-IN' },
    'Shukriya, phir baad mein call karenge.'
  );
  twiml.hangup();

  return new NextResponse(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  });
}
