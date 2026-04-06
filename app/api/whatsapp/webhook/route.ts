import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { downloadWhatsAppMedia, sendWhatsAppText, verifyWebhook } from '@/lib/whatsapp';
import { transcribeAudio } from '@/lib/whisper';
import { extractPatientFromVoiceNote, buildConfirmationMessage } from '@/lib/extraction';
import { normalizePakistaniPhone, isValidPakistaniMobile } from '@/lib/phone';

// GET: webhook verification handshake from Meta
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');

  const result = verifyWebhook(mode, token, challenge);
  if (result) {
    return new NextResponse(result, { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

// POST: incoming messages from doctors
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Extract the message from the Meta webhook envelope
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) {
      // Status update or other event — ack and return
      return NextResponse.json({ ok: true });
    }

    const fromPhone = '+' + message.from; // Meta sends without + prefix
    const supabase = createServerClient();

    // Look up the doctor by phone number
    const { data: doctor } = await supabase
      .from('doctors')
      .select('*')
      .eq('phone', fromPhone)
      .single();

    if (!doctor) {
      await sendWhatsAppText(
        fromPhone,
        'This number is not registered. Please contact support to set up your clinic.'
      );
      return NextResponse.json({ ok: true });
    }

    // Handle "cancel" text commands for undoing the most recent enrollment
    if (message.type === 'text') {
      const text = message.text?.body?.toLowerCase().trim();
      if (text === 'cancel' || text === 'undo') {
        const { data: recent } = await supabase
          .from('enrollments')
          .select('*, appointment_id')
          .eq('doctor_id', doctor.id)
          .eq('status', 'confirmed')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (recent?.appointment_id) {
          await supabase.from('appointments').delete().eq('id', recent.appointment_id);
          await supabase.from('enrollments').update({ status: 'cancelled' }).eq('id', recent.id);
          await sendWhatsAppText(fromPhone, '↩️ Last enrollment cancelled.');
        } else {
          await sendWhatsAppText(fromPhone, 'Nothing to cancel.');
        }
        return NextResponse.json({ ok: true });
      }
      // Other text messages — give a hint
      await sendWhatsAppText(
        fromPhone,
        'Send a voice note with patient details to enroll them for follow-up.\nExample: "Akhtar sahib, 0300-1234567, BP check in two weeks"'
      );
      return NextResponse.json({ ok: true });
    }

    // Only handle voice notes for enrollment
    if (message.type !== 'audio') {
      return NextResponse.json({ ok: true });
    }

    const mediaId = message.audio.id;

    // 1. Download the voice note
    const audioBuf = await downloadWhatsAppMedia(mediaId);

    // 2. Transcribe with Whisper
    const transcript = await transcribeAudio(audioBuf, 'voicenote.ogg');

    // 3. Extract structured data with Claude
    const extracted = await extractPatientFromVoiceNote(transcript);

    // Log the enrollment attempt immediately so we have a paper trail
    const { data: enrollment } = await supabase
      .from('enrollments')
      .insert({
        doctor_id: doctor.id,
        raw_transcript: transcript,
        extracted_data: extracted,
        status: 'pending',
        whatsapp_message_id: message.id,
      })
      .select()
      .single();

    // 4. Validate — if critical fields missing, ask a clarifying question
    const normalizedPhone = extracted.phone_number
      ? normalizePakistaniPhone(extracted.phone_number)
      : null;

    const missing: string[] = [];
    if (!extracted.patient_name) missing.push('name');
    if (!normalizedPhone || !isValidPakistaniMobile(normalizedPhone)) missing.push('phone');
    if (!extracted.followup_date) missing.push('date');

    if (missing.length > 0) {
      const clarify =
        extracted.clarifying_question ||
        `Couldn't catch the ${missing.join(' and ')}. Can you say it again?`;
      await sendWhatsAppText(fromPhone, `⚠️ ${clarify}`);
      await supabase
        .from('enrollments')
        .update({ status: 'needs_clarification' })
        .eq('id', enrollment!.id);
      return NextResponse.json({ ok: true });
    }

    // 5. Find or create the patient
    const { data: existingPatient } = await supabase
      .from('patients')
      .select('*')
      .eq('doctor_id', doctor.id)
      .eq('phone', normalizedPhone!)
      .maybeSingle();

    let patientId: string;
    if (existingPatient) {
      patientId = existingPatient.id;
    } else {
      const { data: newPatient, error } = await supabase
        .from('patients')
        .insert({
          doctor_id: doctor.id,
          name: extracted.patient_name!,
          phone: normalizedPhone!,
          preferred_language: extracted.language_detected === 'en' ? 'en' : 'ur',
        })
        .select()
        .single();
      if (error) throw error;
      patientId = newPatient.id;
    }

    // 6. Create the appointment
    const scheduledFor = new Date(
      `${extracted.followup_date}T${extracted.followup_time ?? '16:00'}:00+05:00`
    );

    const { data: appointment, error: apptErr } = await supabase
      .from('appointments')
      .insert({
        doctor_id: doctor.id,
        patient_id: patientId,
        scheduled_for: scheduledFor.toISOString(),
        reason: extracted.followup_reason,
        status: 'scheduled',
      })
      .select()
      .single();
    if (apptErr) throw apptErr;

    // 7. Mark enrollment confirmed
    await supabase
      .from('enrollments')
      .update({ status: 'confirmed', appointment_id: appointment.id })
      .eq('id', enrollment!.id);

    // 8. Confirm to the doctor
    const confirmationMsg = buildConfirmationMessage(
      { ...extracted, phone_number: normalizedPhone },
      extracted.language_detected
    );
    await sendWhatsAppText(fromPhone, confirmationMsg);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Webhook error:', err);
    // Don't leak errors to Meta — they'll retry. Return 200 and log.
    return NextResponse.json({ ok: true, error: err.message });
  }
}
