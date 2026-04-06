import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { sendWhatsAppText } from '@/lib/whatsapp';

/**
 * End-of-day summary: for each doctor, count how tomorrow's calls went
 * and send a single WhatsApp summary message.
 *
 * Schedule: daily at 8 PM Pakistan time.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabase = createServerClient();

  const { data: doctors } = await supabase.from('doctors').select('*');
  if (!doctors) return NextResponse.json({ ok: true, doctors: 0 });

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const dayAfter = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const results: any[] = [];

  for (const doc of doctors) {
    const { data: appts } = await supabase
      .from('appointments')
      .select('status, patients(name), reason, rescheduled_to, patient_notes')
      .eq('doctor_id', doc.id)
      .gte('scheduled_for', tomorrow.toISOString())
      .lt('scheduled_for', dayAfter.toISOString());

    if (!appts || appts.length === 0) continue;

    const counts = {
      confirmed: 0,
      rescheduled: 0,
      cancelled: 0,
      unreachable: 0,
      no_response: 0,
      scheduled: 0,
    };
    const needsAttention: string[] = [];

    for (const a of appts) {
      counts[a.status as keyof typeof counts] = (counts[a.status as keyof typeof counts] || 0) + 1;
      if (a.status === 'no_response' || a.patient_notes) {
        // @ts-ignore
        needsAttention.push(`⚠️ ${a.patients.name}: ${a.patient_notes || 'unclear response'}`);
      }
    }

    const msg =
      `📋 Tomorrow's follow-ups — ${doc.clinic_name}\n\n` +
      `✅ Confirmed: ${counts.confirmed}\n` +
      `📅 Rescheduled: ${counts.rescheduled}\n` +
      `❌ Cancelled: ${counts.cancelled}\n` +
      `📵 Unreachable: ${counts.unreachable}\n` +
      `⏳ Pending: ${counts.scheduled}\n` +
      (needsAttention.length > 0 ? `\n*Needs your attention:*\n${needsAttention.join('\n')}` : '') +
      `\n\nView details: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard`;

    try {
      await sendWhatsAppText(doc.phone, msg);
      results.push({ doctor: doc.name, sent: true });
    } catch (err: any) {
      results.push({ doctor: doc.name, error: err.message });
    }
  }

  return NextResponse.json({ ok: true, results });
}
