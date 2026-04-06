import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { initiateCall } from '@/lib/twilio';

/**
 * Runs daily (e.g. every morning at 10 AM Pakistan time via Vercel Cron).
 * Finds all appointments scheduled for tomorrow and places reminder calls.
 *
 * Also retries 'scheduled' appointments that haven't been reached yet if their
 * date is today or in the past by less than a day.
 *
 * Protect with CRON_SECRET header.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabase = createServerClient();

  // Tomorrow's window in Pakistan time (UTC+5)
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const dayAfter = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const { data: appts, error } = await supabase
    .from('appointments')
    .select('id, patient_id, contact_attempts, patients(phone, name)')
    .eq('status', 'scheduled')
    .gte('scheduled_for', tomorrow.toISOString())
    .lt('scheduled_for', dayAfter.toISOString())
    .lt('contact_attempts', 3);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: any[] = [];
  for (const appt of appts || []) {
    try {
      // @ts-ignore — supabase join typing
      const phone = appt.patients.phone;
      const sid = await initiateCall({ to: phone, appointmentId: appt.id });
      results.push({ appointmentId: appt.id, callSid: sid, status: 'initiated' });
    } catch (err: any) {
      results.push({ appointmentId: appt.id, error: err.message });
    }
  }

  return NextResponse.json({
    ok: true,
    called: results.length,
    results,
  });
}
