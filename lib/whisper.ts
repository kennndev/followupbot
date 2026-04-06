import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Transcribe an audio file (voice note from WhatsApp or recording from Twilio).
 * Whisper handles Urdu, Punjabi, English, and code-switching natively.
 *
 * We do NOT specify a language param — auto-detection works better for mixed speech.
 */
export async function transcribeAudio(audioBuffer: Buffer, filename = 'audio.ogg'): Promise<string> {
  // The OpenAI SDK expects a File-like object
  const file = new File([new Uint8Array(audioBuffer)], filename, {
    type: filename.endsWith('.ogg') ? 'audio/ogg' : 'audio/mpeg',
  });

  const result = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    // Tip for Pakistani speech: a prompt hint improves domain vocabulary accuracy
    prompt:
      'Pakistani cardiology clinic. Common terms: Dr. Ahmed, follow-up, BP, ECG, angiography, Concor, Tenoric, Lasix, cholesterol, chest pain, ghabrahat, takleef.',
  });

  return result.text;
}

export async function transcribeAudioFromUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch audio from ${url}: ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return transcribeAudio(buf);
}
