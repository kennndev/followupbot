import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Text-to-speech endpoint using OpenAI TTS.
 * Twilio's <Play> tag fetches this URL to get natural-sounding audio.
 * Usage: /api/tts?text=Assalam+o+Alaikum...
 */
export async function GET(req: NextRequest) {
  const text = req.nextUrl.searchParams.get('text');
  if (!text) return new NextResponse('Missing text', { status: 400 });

  const response = await openai.audio.speech.create({
    model: 'tts-1',
    voice: 'nova',   // warm, natural female voice — best for Pakistani clinic context
    input: decodeURIComponent(text),
  });

  const audioBuffer = Buffer.from(await response.arrayBuffer());

  return new NextResponse(audioBuffer, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
