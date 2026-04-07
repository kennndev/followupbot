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
  scheduled:   { label: 'Pending',        color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',    icon: '⏳' },
  contacting:  { label: 'Calling...',     color: 'text-yellow-700',  bg: 'bg-yellow-50 border-yellow-200', icon: '📞' },
  confirmed:   { label: 'Confirmed',      color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: '✅' },
  rescheduled: { label: 'Rescheduled',    color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',  icon: '📅' },
  cancelled:   { label: 'Cancelled',      color: 'text-red-700',     bg: 'bg-red-50 border-red-200',      icon: '❌' },
  unreachable: { label: 'Unreachable',    color: 'text-gray-700',    bg: 'bg-gray-50 border-gray-200',    icon: '📵' },
  no_response: { label: 'Needs Attention',color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200', icon: '⚠️' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.scheduled;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color}`}>
      {cfg.icon} {cfg.label}
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

function AppointmentCard({ appt }: { appt: any }) {
  const [expanded, setExpanded] = useState(false);
  const [transcript, setTranscript] = useState<any[] | null>(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [notes, setNotes] = useState(appt.patient_notes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryMsg, setRetryMsg] = useState('');

  const canRetry = ['unreachable', 'no_response', 'scheduled', 'cancelled'].includes(appt.status);

  async function handleExpand() {
    setExpanded((v) => !v);
    if (!transcript) {
      setLoadingTranscript(true);
      try {
        const res = await fetch(`/api/appointments/${appt.id}/transcript`);
        const data = await res.json();
        setTranscript(data);
      } catch {
        setTranscript([]);
      } finally {
        setLoadingTranscript(false);
      }
    }
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    await fetch(`/api/appointments/${appt.id}/notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    setSavingNotes(false);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  }

  async function handleRetry() {
    setRetrying(true);
    setRetryMsg('');
    try {
      const res = await fetch(`/api/appointments/${appt.id}/retry`, { method: 'POST' });
      const data = await res.json();
      setRetryMsg(data.ok ? '✅ Call initiated!' : `❌ ${data.error}`);
    } catch {
      setRetryMsg('❌ Failed to initiate call');
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      {/* Main row */}
      <div
        className="p-4 flex items-start justify-between gap-4 cursor-pointer"
        onClick={handleExpand}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h4 className="font-semibold text-gray-900 truncate">{appt.patients?.name || 'Unknown'}</h4>
            <StatusBadge status={appt.status} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
            <span>🕐 {new Date(appt.scheduled_for).toLocaleString('en-PK', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            <span>📞 {formatForDisplay(appt.patients?.phone || '')}</span>
            {appt.reason && <span>📋 {appt.reason}</span>}
            {appt.contact_attempts > 0 && <span className="text-gray-400">{appt.contact_attempts} call{appt.contact_attempts > 1 ? 's' : ''}</span>}
          </div>
        </div>
        <span className="text-gray-400 text-sm mt-1">{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-5">

          {/* Call Transcript */}
          <div>
            <h5 className="text-sm font-semibold text-gray-700 mb-2">📞 Call Transcript</h5>
            {loadingTranscript && <p className="text-sm text-gray-400">Loading...</p>}
            {transcript && transcript.length === 0 && (
              <p className="text-sm text-gray-400 italic">No calls recorded yet.</p>
            )}
            {transcript && transcript.length > 0 && (
              <div className="space-y-3">
                {transcript.map((log, i) => {
                  const turns = log.transcript?.turns || [];
                  return (
                    <div key={i} className="bg-gray-50 rounded-lg p-3 text-sm">
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                        <span>Attempt {i + 1}</span>
                        <span className={`px-2 py-0.5 rounded-full font-medium ${
                          log.outcome === 'confirm_yes' ? 'bg-emerald-100 text-emerald-700' :
                          log.outcome === 'reschedule' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{log.outcome || log.status}</span>
                      </div>
                      {turns.length === 0 && <p className="text-gray-400 italic">No speech recorded.</p>}
                      {turns.map((turn: any, j: number) => (
                        <div key={j} className={`flex gap-2 mb-1 ${turn.role === 'bot' ? 'justify-start' : 'justify-end'}`}>
                          <span className={`px-3 py-1.5 rounded-2xl text-sm max-w-xs ${
                            turn.role === 'bot'
                              ? 'bg-blue-100 text-blue-900'
                              : 'bg-emerald-100 text-emerald-900'
                          }`}>
                            {turn.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Doctor Notes */}
          <div>
            <h5 className="text-sm font-semibold text-gray-700 mb-2">📝 Doctor Notes</h5>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this patient..."
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="px-4 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 transition"
              >
                {savingNotes ? 'Saving...' : 'Save Notes'}
              </button>
              {notesSaved && <span className="text-sm text-emerald-600">✅ Saved</span>}
            </div>
          </div>

          {/* Retry Button */}
          {canRetry && (
            <div>
              <h5 className="text-sm font-semibold text-gray-700 mb-2">📲 Call Patient Again</h5>
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition flex items-center gap-2"
              >
                {retrying ? '⏳ Calling...' : '📞 Retry Call Now'}
              </button>
              {retryMsg && <p className="text-sm mt-2">{retryMsg}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DashboardClient({ doctor, appointments, enrollments, stats }: Props) {
  const [filter, setFilter] = useState<string>('all');

  const filtered = filter === 'all' ? appointments : appointments.filter((a) => a.status === filter);

  // Group by date
  const grouped: Record<string, typeof appointments> = {};
  for (const appt of filtered) {
    const dateKey = new Date(appt.scheduled_for).toLocaleDateString('en-PK', {
      weekday: 'long', month: 'short', day: 'numeric',
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
              <span className="text-2xl">🩺</span> FollowUp Bot
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
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Patients" value={stats.totalPatients} accent="text-gray-900" />
          <StatCard label="Pending Calls"  value={stats.upcoming}      accent="text-blue-600" />
          <StatCard label="Confirmed"      value={stats.confirmed}     accent="text-emerald-600" />
          <StatCard label="Needs Attention" value={stats.needsAttention} accent="text-orange-600" />
        </div>

        {/* How It Works Banner */}
        {stats.totalPatients < 5 && (
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
            <h2 className="text-lg font-bold mb-3">📱 How to add patients</h2>
            <p className="text-emerald-100 text-sm leading-relaxed">
              Send a <strong>voice note</strong> to your clinic's WhatsApp bot number with the patient details.<br />
              Example: <em>"Akhtar sahib, 0300-1234567, BP follow-up do hafte baad"</em><br /><br />
              The bot will confirm and automatically call the patient one day before their appointment.
            </p>
          </div>
        )}

        {/* Filter Tabs */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">Appointments</h2>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[
              { key: 'all',         label: 'All' },
              { key: 'confirmed',   label: '✅ Confirmed' },
              { key: 'scheduled',   label: '⏳ Pending' },
              { key: 'no_response', label: '⚠️ Attention' },
              { key: 'unreachable', label: '📵 Unreachable' },
              { key: 'cancelled',   label: '❌ Cancelled' },
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
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{dateLabel}</h3>
                <div className="space-y-3">
                  {appts.map((appt) => <AppointmentCard key={appt.id} appt={appt} />)}
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
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        e.status === 'confirmed'           ? 'bg-emerald-50 text-emerald-700' :
                        e.status === 'needs_clarification' ? 'bg-yellow-50 text-yellow-700' :
                        e.status === 'cancelled'           ? 'bg-red-50 text-red-700' :
                                                             'bg-gray-50 text-gray-600'
                      }`}>
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
