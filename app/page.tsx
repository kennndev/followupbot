import { createServerClient } from '@/lib/supabase';
import Link from 'next/link';

const AVATAR_COLORS = [
  'bg-emerald-500', 'bg-blue-500', 'bg-violet-500', 'bg-orange-500', 'bg-pink-500',
];

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export default async function HomePage() {
  const supabase = createServerClient();
  const { data: doctors } = await supabase
    .from('doctors')
    .select('id, name, clinic_name, password_hash')
    .order('created_at', { ascending: true });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-emerald-50/30 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-3">
            <span>🩺</span> FollowUp Bot
          </h1>
          <p className="text-gray-500 mt-2">Select your clinic to continue</p>
        </div>

        <div className="space-y-3">
          {(doctors || []).map((doc, i) => {
            const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
            return (
              <Link
                key={doc.id}
                href={`/login/${doc.id}`}
                className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all group"
              >
                <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center text-white font-bold text-lg flex-shrink-0`}>
                  {getInitials(doc.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{doc.name}</p>
                  <p className="text-sm text-gray-500 truncate">{doc.clinic_name}</p>
                </div>
                <span className="text-gray-300 group-hover:text-emerald-500 transition-colors text-xl">→</span>
              </Link>
            );
          })}
        </div>

        {(!doctors || doctors.length === 0) && (
          <div className="text-center text-gray-400 py-12">
            <p>No doctors found. Add a doctor in Supabase first.</p>
          </div>
        )}
      </div>
    </div>
  );
}
