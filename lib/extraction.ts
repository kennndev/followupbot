import Anthropic from '@anthropic-ai/sdk';
import { ExtractedPatientData } from './supabase';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Extraction prompt — iterate on this hard during pilot.
 * Every failure mode you see in real doctor voice notes should add a rule here.
 */
function buildExtractionPrompt(today: Date): string {
  const todayISO = today.toISOString().split('T')[0];
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });

  return `You are an assistant helping a Pakistani cardiology clinic enroll follow-up patients.
The doctor sends messy voice notes in mixed Urdu, English, and Punjabi after each consultation.
Your job: extract structured data from the transcript.

Today is ${dayName}, ${todayISO}.
The clinic is closed on Sundays.

Extract these fields from the transcript:
1. patient_name (string) — the patient's name. Keep it as heard; don't anglicize.
2. phone_number (string) — normalize to +92XXXXXXXXXX format. Pakistani mobiles are 11 digits starting with 03, or 10 digits starting with 3. If you hear spelled-out digits like "zero three double zero", convert them. "Double" means the next digit twice, "triple" means three times.
3. followup_date (YYYY-MM-DD) — resolve relative dates using today as the reference:
   - "kal" / "tomorrow" → next day
   - "parsoon" → day after tomorrow
   - "agle hafte" / "next week" → 7 days from today
   - "do hafte baad" / "in two weeks" → 14 days from today
   - "mahine baad" / "in a month" → 30 days from today
   - "agle Jumma" / "next Friday" → the upcoming Friday
   - "15 tareekh" → the 15th of this month (or next month if already past)
   - "jab lab report aa jaye" / "when report comes" → mark as ambiguous, ask clarification
   NEVER pick a Sunday — if the calculated date is a Sunday, push to Monday and note it.
4. followup_time (HH:MM 24-hour) — if the doctor mentions a specific time like "4 baje" or "evening", use it. Default to "16:00" if not mentioned.
5. followup_reason (short English phrase) — translate the reason to concise English: "BP review", "post-MI check", "ECG follow-up", "lab results review", "post-angiography", etc.
6. language_detected — which language the doctor mainly used: "ur" (Urdu), "en" (English), "pa" (Punjabi), or "mixed".

Rules:
- If the doctor corrects themselves mid-sentence ("0300... nahi nahi, 0301"), take the latest correction.
- If the doctor lists multiple patients in one note, extract only the FIRST one and add "multiple_patients_detected" to missing_fields.
- If any REQUIRED field (name, phone, date) is missing or ambiguous, populate what you can and set clarifying_question to a single short question in the same language the doctor used.
- Do NOT invent data. If you're not sure, mark it missing.
- Always return valid JSON matching the schema below. No markdown, no explanation.

Output JSON schema (return exactly this shape):
{
  "patient_name": string | null,
  "phone_number": string | null,
  "followup_date": string | null,
  "followup_time": string | null,
  "followup_reason": string | null,
  "missing_fields": string[],
  "clarifying_question": string | null,
  "language_detected": "ur" | "en" | "pa" | "mixed"
}`;
}

export async function extractPatientFromVoiceNote(
  transcript: string,
  today: Date = new Date()
): Promise<ExtractedPatientData> {
  const systemPrompt = buildExtractionPrompt(today);

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Transcript:\n"${transcript}"\n\nExtract the structured data as JSON.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text content');
  }

  // Strip any markdown fences the model might add despite instructions
  const clean = textBlock.text
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();

  try {
    const parsed = JSON.parse(clean) as ExtractedPatientData;
    return parsed;
  } catch (err) {
    throw new Error(`Failed to parse Claude response as JSON: ${clean}`);
  }
}

/**
 * Build the confirmation message sent back to the doctor after enrollment.
 * Language matches what Claude detected the doctor was speaking.
 */
export function buildConfirmationMessage(
  data: ExtractedPatientData,
  language: 'ur' | 'en' | 'pa' | 'mixed'
): string {
  const dateStr = data.followup_date
    ? new Date(data.followup_date).toLocaleDateString('en-PK', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'date missing';

  if (language === 'ur' || language === 'mixed') {
    return `✅ Done.\n\nPatient: ${data.patient_name}\nPhone: ${data.phone_number}\nFollow-up: ${dateStr} ${data.followup_time ?? ''}\nReason: ${data.followup_reason}\n\nMain aik din pehle call karoon ga. Ghalat ho to "cancel" reply karein.`;
  }
  return `✅ Done.\n\nPatient: ${data.patient_name}\nPhone: ${data.phone_number}\nFollow-up: ${dateStr} ${data.followup_time ?? ''}\nReason: ${data.followup_reason}\n\nI'll contact them one day before. Reply "cancel" to undo.`;
}
