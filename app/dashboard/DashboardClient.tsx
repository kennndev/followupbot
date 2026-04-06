'use client';

import { useState } from 'react';
import { formatForDisplay } from '@/lib/phone';

interface Props {
  doctor: any;
  appointments: any[];
  enrollments: any[];
  stats: {
    totalPatients: number;
    upcoming: number;
    confirmed: number;
    needsAttention: number;
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  scheduled: { label: 'Pending', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: '⏳' },
  contacting: { label: 'Calling...', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', icon: '📞' },
  confirmed: { label: 'Confirmed', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: '✅' },
  rescheduled: { label: 'Rescheduled', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: '📅' },
  cancelled: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: '❌' },
  unreachable: { label: 'Unreachable', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200', icon: '📵' },
  no_response: { label: 'Needs Attention', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: '⚠️' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.scheduled;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color}`}>
      <span>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

export default function DashboardClient({ doctor, appointments, enrollments, stats }: Props) {
  const [filter, setFilter] = useState<string>('all');

  const filtered =
    filter === 'all'
      ? appointments
      : appointments.filter((a) => a.status === filter);

  // Group by date
  const grouped: Record<string, typeof appointments> = {};
  for (const appt of filtered) {
    const dateKey = new Date(appt.scheduled_for).toLocaleDateString('en-PK', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(appt);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50/30">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="text-2xl">🩺</span>
              FollowUp Bot
            </h1>
            <p className="text-sm text-gray-500">{doctor.clinic_name} — {doctor.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm text-gray-600">Active</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Patients" value={stats.totalPatients} accent="text-gray-900" />
          <StatCard label="This Week" value={stats.upcoming} accent="text-blue-600" />
          <StatCard label="Confirmed" value={stats.confirmed} accent="text-emerald-600" />
          <StatCard label="Needs Attention" value={stats.needsAttention} accent="text-orange-600" />
        </div>

        {/* How It Works Banner — shows only when few patients */}
        {stats.totalPatients < 5 && (
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
            <h2 className="text-lg font-bold mb-3">📱 How to add patients</h2>
            <p className="text-emerald-100 text-sm leading-relaxed">
              Send a <strong>voice note</strong> to your clinic's WhatsApp bot number with the patient details.
              <br />
              Example: <em>"Akhtar sahib, 0300-1234567, BP follow-up do hafte baad"</em>
              <br /><br />
              The bot will confirm and automatically call the patient one day before their appointment.
            </p>
          </div>
        )}

        {/* Filter Tabs */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">Upcoming Follow-ups</h2>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[
              { key: 'all', label: 'All' },
              { key: 'confirmed', label: '✅ Confirmed' },
              { key: 'scheduled', label: '⏳ Pending' },
              { key: 'no_response', label: '⚠️ Attention' },
              { key: 'cancelled', label: '❌ Cancelled' },
              { key: 'unreachable', label: '📵 Unreachable' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  filter === tab.key
                    ? 'bg-gray-900 text-white shadow-md'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Appointments List */}
        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-lg">No appointments found</p>
            <p className="text-sm mt-1">Send a voice note to add patients</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([dateLabel, appts]) => (
              <div key={dateLabel}>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {dateLabel}
                </h3>
                <div className="space-y-3">
                  {appts.map((appt) => (
                    <div
                      key={appt.id}
                      className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h4 className="font-semibold text-gray-900 truncate">
                              {appt.patients?.name || 'Unknown'}
                            </h4>
                            <StatusBadge status={appt.status} />
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                            <span>
                              🕐{' '}
                              {new Date(appt.scheduled_for).toLocaleTimeString('en-PK', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <span>📞 {formatForDisplay(appt.patients?.phone || '')}</span>
                            {appt.reason && <span>📋 {appt.reason}</span>}
                          </div>
                          {appt.patient_notes && (
                            <p className="text-sm text-orange-600 mt-2 bg-orange-50 rounded-lg px-3 py-1.5 border border-orange-100">
                              💬 {appt.patient_notes}
                            </p>
                          )}
                          {appt.rescheduled_to && (
                            <p className="text-sm text-amber-600 mt-2">
                              📅 Rescheduled to:{' '}
                              {new Date(appt.rescheduled_to).toLocaleDateString('en-PK', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </p>
                          )}
                        </div>
                        <div className="text-right text-xs text-gray-400">
                          {appt.contact_attempts > 0 && (
                            <span>{appt.contact_attempts} call{appt.contact_attempts > 1 ? 's' : ''}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recent Enrollments */}
        {enrollments.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Recent Enrollments</h2>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="divide-y divide-gray-50">
                {enrollments.map((e) => {
                  const data = e.extracted_data as any;
                  return (
                    <div key={e.id} className="px-4 py-3 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {data?.patient_name || 'Parsing...'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{e.raw_transcript}</p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          e.status === 'confirmed'
                            ? 'bg-emerald-50 text-emerald-700'
                            : e.status === 'needs_clarification'
                            ? 'bg-yellow-50 text-yellow-700'
                            : e.status === 'cancelled'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-gray-50 text-gray-600'
                        }`}
                      >
                        {e.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        FollowUp Bot v1.0 — Built for Pakistani clinics
      </footer>
    </div>
  );
}
