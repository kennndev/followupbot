import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const cookieStore = cookies();
  const doctorId = cookieStore.get('ds')?.value;
  if (!doctorId) redirect('/');

  const supabase = createServerClient();
  const { data: doctor } = await supabase
    .from('doctors')
    .select('*')
    .eq('id', doctorId)
    .single();

  if (!doctor) redirect('/');

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, patients(id, name, phone, diagnosis, medications)')
    .eq('doctor_id', doctor.id)
    .gte('scheduled_for', thirtyDaysAgo.toISOString())
    .lte('scheduled_for', thirtyDaysAhead.toISOString())
    .order('scheduled_for', { ascending: false });

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('*')
    .eq('doctor_id', doctor.id)
    .order('created_at', { ascending: false })
    .limit(10);

  const { count: totalPatients } = await supabase
    .from('patients')
    .select('*', { count: 'exact', head: true })
    .eq('doctor_id', doctor.id);

  const { data: allAppointments } = await supabase
    .from('appointments')
    .select('status')
    .eq('doctor_id', doctor.id);

  const all = allAppointments || [];
  const confirmed = all.filter((a) => a.status === 'confirmed').length;
  const totalContacted = all.filter((a) =>
    ['confirmed', 'rescheduled', 'cancelled', 'unreachable', 'no_response'].includes(a.status)
  ).length;

  const stats = {
    totalPatients: totalPatients || 0,
    upcoming: all.filter((a) => ['scheduled', 'contacting'].includes(a.status)).length,
    confirmed,
    needsAttention: all.filter((a) => ['no_response', 'unreachable'].includes(a.status)).length,
    recoveryRate: totalContacted > 0 ? Math.round((confirmed / totalContacted) * 100) : 0,
  };

  return (
    <DashboardClient
      doctor={doctor}
      appointments={appointments || []}
      enrollments={enrollments || []}
      stats={stats}
    />
  );
}
