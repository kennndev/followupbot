import { createServerClient } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import LoginForm from './LoginForm';

const AVATAR_COLORS = [
  'bg-emerald-500', 'bg-blue-500', 'bg-violet-500', 'bg-orange-500', 'bg-pink-500',
];

export default async function LoginPage({ params }: { params: { doctorId: string } }) {
  const supabase = createServerClient();

  const [{ data: doctor }, { data: allDoctors }] = await Promise.all([
    supabase.from('doctors').select('id, name, clinic_name, password_hash').eq('id', params.doctorId).single(),
    supabase.from('doctors').select('id').order('created_at', { ascending: true }),
  ]);

  if (!doctor) notFound();

  const idx = (allDoctors || []).findIndex((d) => d.id === doctor.id);
  const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];

  return (
    <LoginForm
      doctor={doctor}
      color={color}
      hasPassword={!!doctor.password_hash}
    />
  );
}
