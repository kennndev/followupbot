import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { createServerClient } from '@/lib/supabase';
import {
  processPatientReply,
  CallContext,
  ConversationState,
  intentToStatus,
} from '@/lib/conversation';
import { sendWhatsAppText } from '@/lib/whatsapp';

/**
 * Handle the patient's spoken reply. Twilio posts form-encoded data including
 * SpeechResult (transcribed text). We send it to GPT, get the next line,
 * and either continue the conversation or hang up.
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const appointmentId = url.searchParams.get('appointmentId');
  const stateParam = url.searchParams.get('state') || 'greeting';
  const turnCount = parseInt(url.searchParams.get('turn') || '0', 10);

  if (!appointmentId) {
    return new NextResponse('Missing appointmentId', { status: 400 });
  }

  const baseUrl = process.env.TWILIO_WEBHOOK_BASE_URL!;

  const formData = await req.formData();
  const speechResult = (formData.get('SpeechResult') as string) || '';
  const confidence = parseFloat((formData.get('Confidence') as string) || '0');

  const supabase = createServerClient();
  const { data: appt } = await supabase
    .from('appointments')
    .select('*, patients(*), doctors(*)')
    .eq('id', appointmentId)
    .single();

  if (!appt) {
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.hangup();
    return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
  }

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

  const ttsUrl = (text: string) =>
    `${baseUrl}/api/tts?text=${encodeURIComponent(text)}`;

  // Handle empty speech result
  if (!speechResult.trim()) {
    const twiml = new twilio.twiml.VoiceResponse();
    const msg =
      ctx.language === 'ur'
        ? 'Maazrat, awaz nahi aayi. Dr sahib ki clinic se phir call karenge. Shukriya.'
        : 'Sorry, I did not hear you. The clinic will call again. Thank you.';
    twiml.play(ttsUrl(msg));
    twiml.hangup();
    return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
  }

  const state: ConversationState = {
    step: stateParam as ConversationState['step'],
    turn_count: turnCount,
  };

  // Call GPT to process the reply
  let reply: string;
  let newState: ConversationState;
  let shouldHangup: boolean;
  try {
    const result = await processPatientReply(speechResult, state, ctx);
    reply = result.reply;
    newState = result.newState;
    shouldHangup = result.shouldHangup;
  } catch (err) {
    console.error('Conversation error:', err);
    const twiml = new twilio.twiml.VoiceResponse();
    const msg =
      ctx.language === 'ur'
        ? 'Maazrat, koi technical masla hai. Dr. sahib ki clinic aap ko call karegi.'
        : 'Sorry, technical issue. The clinic will call you back.';
    twiml.play(ttsUrl(msg));
    twiml.hangup();
    return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } });
  }

  // Append transcript turn to call_logs
  await supabase.from('call_logs').upsert(
    {
      appointment_id: appointmentId,
      twilio_call_sid: (formData.get('CallSid') as string) || null,
      transcript: {
        turns: [
          { role: 'patient', text: speechResult, confidence },
          { role: 'bot', text: reply },
        ],
      },
      outcome: newState.intent || 'unclear',
    },
    { onConflict: 'twilio_call_sid' }
  );

  const twiml = new twilio.twiml.VoiceResponse();

  if (shouldHangup || newState.step === 'done' || newState.step === 'closing') {
    // Final line + hangup
    twiml.play(ttsUrl(reply));
    twiml.hangup();

    // Update appointment status based on final intent
    const finalStatus = intentToStatus(newState.intent);
    await supabase
      .from('appointments')
      .update({
        status: finalStatus as any,
        patient_notes: newState.patient_notes,
      })
      .eq('id', appointmentId);

    // Notify doctor immediately via WhatsApp
    const doctorPhone = appt.doctors.phone;
    const patientName = appt.patients.name;
    const apptDate = new Date(appt.scheduled_for).toLocaleDateString('en-PK', {
      weekday: 'long', month: 'long', day: 'numeric',
    });

    const statusEmoji: Record<string, string> = {
      confirmed: '✅',
      rescheduled: '📅',
      cancelled: '❌',
      no_response: '⚠️',
    };
    const emoji = statusEmoji[finalStatus] || '📋';

    const notifyMessages: Record<string, string> = {
      confirmed: `${emoji} *${patientName}* ne kal ki appointment confirm kar di.\nDate: ${apptDate}\nReason: ${appt.reason || 'follow-up'}`,
      rescheduled: `${emoji} *${patientName}* reschedule karna chahte hain.\nAap unhe call karein.\n${newState.patient_notes ? `Note: ${newState.patient_notes}` : ''}`,
      cancelled: `${emoji} *${patientName}* ne appointment cancel kar di.\n${newState.patient_notes ? `Reason: ${newState.patient_notes}` : ''}`,
      no_response: `${emoji} *${patientName}* se baat hui lekin jawab unclear tha.\n${newState.patient_notes ? `Note: ${newState.patient_notes}` : ''}\nAap khud call kar lein.`,
    };

    const message = notifyMessages[finalStatus] || `${emoji} *${patientName}* ka call complete hua. Status: ${finalStatus}`;

    try {
      await sendWhatsAppText(doctorPhone, message);
    } catch (err) {
      console.error('Doctor WhatsApp notification failed:', err);
    }
  } else {
    // Continue the conversation: play reply + gather next utterance
    const gather = twiml.gather({
      input: ['speech'],
      language: (ctx.language === 'ur' ? 'ur-PK' : 'en-IN') as any,
      speechTimeout: 'auto',
      action: `/api/twilio/response?appointmentId=${appointmentId}&state=${newState.step}&turn=${newState.turn_count}`,
      method: 'POST',
    });
    gather.play(ttsUrl(reply));

    // Fallback if no reply detected
    twiml.play(ttsUrl('Shukriya, phir baad mein baat karenge.'));
    twiml.hangup();
  }

  return new NextResponse(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  });
}
