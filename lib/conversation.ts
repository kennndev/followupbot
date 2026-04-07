import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type CallIntent =
  | 'confirm_yes'       // patient will come
  | 'reschedule'        // patient wants a new date
  | 'cancel_no_need'    // patient says they're fine, doesn't need follow-up
  | 'cancel_traveling'  // patient can't come for logistics
  | 'cancel_cost'       // patient citing money concerns
  | 'needs_help'        // patient mentions symptoms / wants to talk to doctor
  | 'unclear'           // couldn't understand
  | 'wants_callback';   // asked to be called later

export interface ConversationState {
  step: 'greeting' | 'confirming' | 'reschedule_asking' | 'reason_asking' | 'closing' | 'done';
  intent?: CallIntent;
  rescheduled_date?: string;
  patient_notes?: string;
  turn_count: number;
}

export interface CallContext {
  patient_name: string;
  doctor_name: string;
  clinic_name: string;
  appointment_date: string; // human-readable
  appointment_reason: string;
  language: 'ur' | 'en' | 'pa';
  diagnosis?: string;    // e.g. "Hypertension, post-MI"
  medications?: string;  // e.g. "Concor 5mg, Aspirin 75mg"
}

/**
 * Generate the opening message when the patient picks up.
 * This is the first thing Twilio will speak aloud.
 */
export function buildOpeningLine(ctx: CallContext): string {
  if (ctx.language === 'ur') {
    return `Assalam-o-Alaikum, ${ctx.patient_name} sahib. Yeh ${ctx.clinic_name} se reminder call hai. ${ctx.doctor_name} ne aap ko kal ${ctx.appointment_reason} ke liye bulaya tha. Kya aap kal appointment par aa sakte hain? Haan ya nahi mein jawab de dein.`;
  }
  return `Assalam-o-Alaikum ${ctx.patient_name}. This is a reminder call from ${ctx.clinic_name}. ${ctx.doctor_name} has scheduled your follow-up for tomorrow for ${ctx.appointment_reason}. Will you be able to come? Please say yes or no.`;
}

/**
 * Send patient's spoken reply to Claude for intent classification and next response.
 */
export async function processPatientReply(
  patientUtterance: string,
  state: ConversationState,
  ctx: CallContext
): Promise<{ reply: string; newState: ConversationState; shouldHangup: boolean }> {
  const systemPrompt = `You are a warm, respectful phone assistant calling Pakistani patients on behalf of ${ctx.clinic_name} (${ctx.doctor_name}).

Context:
- Patient: ${ctx.patient_name}
- Appointment: ${ctx.appointment_date}
- Reason: ${ctx.appointment_reason}
- Language: respond in ${ctx.language === 'ur' ? 'Urdu (Roman Urdu script is fine for TTS)' : 'English'}${ctx.diagnosis ? `\n- Diagnosis: ${ctx.diagnosis}` : ''}${ctx.medications ? `\n- Current medications: ${ctx.medications}` : ''}

Your job is a reminder call with exactly this flow:
1. GREETING (already done) — you've asked if they can come.
2. CONFIRMING — based on their answer, branch:
   - If YES: confirm the appointment time, thank them, end.
   - If NO: ask if they want to reschedule. If yes, offer to book a new date. If no, gently ask if everything is OK and remind them they can contact the clinic anytime.
3. CLOSING — polite goodbye.

Rules:
- Keep every message SHORT (under 25 words, 1-2 sentences).
- NEVER give medical advice. If they describe symptoms, say: "Main ${ctx.doctor_name} ko bata doon ga, woh aap ko call karenge."
- Be warm, never robotic. Use "sahib/sahiba" for respect.
- If the patient is confused or angry, apologize and offer to have the doctor call back.
- NEVER make up dates or times. If they want to reschedule, say the doctor's office will confirm the new date.

Current conversation state: ${JSON.stringify(state)}

Respond with a JSON object (no markdown, just JSON):
{
  "reply": "what you'll say aloud to the patient",
  "intent": "confirm_yes" | "reschedule" | "cancel_no_need" | "cancel_traveling" | "cancel_cost" | "needs_help" | "unclear" | "wants_callback",
  "next_step": "confirming" | "reschedule_asking" | "reason_asking" | "closing" | "done",
  "patient_notes": "short English summary of anything the patient mentioned (symptoms, concerns, reason for cancel)",
  "should_hangup": boolean
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 400,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Patient said: "${patientUtterance}"\n\nRespond with the JSON.`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error('OpenAI returned no text');
  }

  const parsed = JSON.parse(text);

  const newState: ConversationState = {
    step: parsed.next_step,
    intent: parsed.intent,
    patient_notes: parsed.patient_notes || state.patient_notes,
    turn_count: state.turn_count + 1,
  };

  return {
    reply: parsed.reply,
    newState,
    shouldHangup: parsed.should_hangup || newState.turn_count >= 6,
  };
}

/**
 * Map a final intent to an appointment status for the database.
 */
export function intentToStatus(intent: CallIntent | undefined): string {
  switch (intent) {
    case 'confirm_yes':
      return 'confirmed';
    case 'reschedule':
      return 'rescheduled';
    case 'cancel_no_need':
    case 'cancel_traveling':
    case 'cancel_cost':
      return 'cancelled';
    case 'needs_help':
    case 'wants_callback':
      return 'no_response'; // doctor needs to see this
    default:
      return 'no_response';
  }
}
