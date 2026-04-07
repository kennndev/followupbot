import { createServerClient } from '@/lib/supabase';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = createServerClient();

  // For MVP: hardcoded to first doctor. In prod, use auth.
  const { data: doctor } = await supabase
    .from('doctors')
    .select('*')
    .limit(1)
    .single();

  if (!doctor) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">No doctor found. Run the schema.sql seed first.</p>
      </div>
    );
  }

  // Get appointments: last 30 days + next 30 days
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, patients(name, phone)')
    .eq('doctor_id', doctor.id)
    .gte('scheduled_for', thirtyDaysAgo.toISOString())
    .lte('scheduled_for', thirtyDaysAhead.toISOString())
    .order('scheduled_for', { ascending: false });

  // Get recent enrollments
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('*')
    .eq('doctor_id', doctor.id)
    .order('created_at', { ascending: false })
    .limit(10);

  // Stats — all time
  const { count: totalPatients } = await supabase
    .from('patients')
    .select('*', { count: 'exact', head: true })
    .eq('doctor_id', doctor.id);

  const { data: allAppointments } = await supabase
    .from('appointments')
    .select('status')
    .eq('doctor_id', doctor.id);

  const all = allAppointments || [];
  const stats = {
    totalPatients: totalPatients || 0,
    upcoming: all.filter((a) => a.status === 'scheduled' || a.status === 'contacting').length,
    confirmed: all.filter((a) => a.status === 'confirmed').length,
    needsAttention: all.filter(
      (a) => a.status === 'no_response' || a.status === 'unreachable'
    ).length,
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
