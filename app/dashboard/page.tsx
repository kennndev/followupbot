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

  // Get appointments for next 7 days
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, patients(name, phone)')
    .eq('doctor_id', doctor.id)
    .gte('scheduled_for', now.toISOString())
    .lte('scheduled_for', weekFromNow.toISOString())
    .order('scheduled_for', { ascending: true });

  // Get recent enrollments
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('*')
    .eq('doctor_id', doctor.id)
    .order('created_at', { ascending: false })
    .limit(10);

  // Stats
  const { count: totalPatients } = await supabase
    .from('patients')
    .select('*', { count: 'exact', head: true })
    .eq('doctor_id', doctor.id);

  const stats = {
    totalPatients: totalPatients || 0,
    upcoming: (appointments || []).length,
    confirmed: (appointments || []).filter((a) => a.status === 'confirmed').length,
    needsAttention: (appointments || []).filter(
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
