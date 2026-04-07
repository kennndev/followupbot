import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  const { doctorId, password, isSetup } = await req.json();

  const supabase = createServerClient();
  const { data: doctor } = await supabase
    .from('doctors')
    .select('id, password_hash')
    .eq('id', doctorId)
    .single();

  if (!doctor) return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });

  if (isSetup) {
    if (doctor.password_hash) {
      return NextResponse.json({ error: 'Password already set' }, { status: 400 });
    }
    const hash = await bcrypt.hash(password, 12);
    await supabase.from('doctors').update({ password_hash: hash }).eq('id', doctorId);
  } else {
    if (!doctor.password_hash) {
      return NextResponse.json({ error: 'No password set. Please set up your password first.' }, { status: 400 });
    }
    const valid = await bcrypt.compare(password, doctor.password_hash);
    if (!valid) return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set('ds', doctorId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  return response;
}
