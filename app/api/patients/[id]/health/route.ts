import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const doctorId = req.cookies.get('ds')?.value;
  if (!doctorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { diagnosis, medications } = await req.json();
  const supabase = createServerClient();

  const { error } = await supabase
    .from('patients')
    .update({ diagnosis, medications })
    .eq('id', params.id)
    .eq('doctor_id', doctorId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
