'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatForDisplay } from '@/lib/phone';

interface Stats {
  totalPatients: number;
  upcoming: number;
  confirmed: number;
  needsAttention: number;
  recoveryRate: number;
}

interface Props {
  doctor: any;
  appointments: any[];
  enrollments: any[];
  stats: Stats;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  scheduled:   { label: 'Pending',         color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',     icon: '⏳' },
  contacting:  { label: 'Calling...',      color: 'text-yellow-700',  bg: 'bg-yellow-50 border-yellow-200', icon: '📞' },
  confirmed:   { label: 'Confirmed',       color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: '✅' },
  rescheduled: { label: 'Rescheduled',     color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',   icon: '📅' },
  cancelled:   { label: 'Cancelled',       color: 'text-red-700',     bg: 'bg-red-50 border-red-200',       icon: '❌' },
  unreachable: { label: 'Unreachable',     color: 'text-gray-700',    bg: 'bg-gray-50 border-gray-200',     icon: '📵' },
  no_response: { label: 'Needs Attention', color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200', icon: '⚠️' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.scheduled;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ─── Add Patient Modal ─────────────────────────────────────────────────────────

function AddPatientModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: '', phone: '', date: '', time: '16:00', reason: '', diagnosis: '', medications: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await fetch('/api/patients/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || 'Failed to add patient'); return; }
    onSuccess();
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Add New Patient</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-700 block mb-1">Patient Name *</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} required
                placeholder="Akhtar sahib" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-700 block mb-1">Phone Number *</label>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} required
                placeholder="0300-1234567" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Follow-up Date *</label>
              <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Time</label>
              <input type="time" value={form.time} onChange={(e) => set('time', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-700 block mb-1">Reason *</label>
              <input value={form.reason} onChange={(e) => set('reason', e.target.value)} required
                placeholder="BP review, ECG follow-up, post-MI check..." className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Health Profile (optional — bot uses this in the call)</p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Diagnosis</label>
                <input value={form.diagnosis} onChange={(e) => set('diagnosis', e.target.value)}
                  placeholder="Hypertension, post-MI, Type 2 DM..." className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Current Medications</label>
                <input value={form.medications} onChange={(e) => set('medications', e.target.value)}
                  placeholder="Concor 5mg, Aspirin 75mg, Lasix..." className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-emerald-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition">
              {loading ? 'Adding...' : '✓ Add Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Appointment Card ──────────────────────────────────────────────────────────

function AppointmentCard({ appt, onRebook }: { appt: any; onRebook: (appt: any) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [transcript, setTranscript] = useState<any[] | null>(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [notes, setNotes] = useState(appt.patient_notes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [diagnosis, setDiagnosis] = useState(appt.patients?.diagnosis || '');
  const [medications, setMedications] = useState(appt.patients?.medications || '');
  const [savingHealth, setSavingHealth] = useState(false);
  const [healthSaved, setHealthSaved] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryMsg, setRetryMsg] = useState('');

  const canRetry = ['unreachable', 'no_response', 'scheduled', 'cancelled'].includes(appt.status);

  async function handleExpand() {
    setExpanded((v) => !v);
    if (!transcript) {
      setLoadingTranscript(true);
      try {
        const res = await fetch(`/api/appointments/${appt.id}/transcript`);
        setTranscript(await res.json());
      } catch { setTranscript([]); }
      finally { setLoadingTranscript(false); }
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

  async function handleSaveHealth() {
    setSavingHealth(true);
    await fetch(`/api/patients/${appt.patients?.id}/health`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ diagnosis, medications }),
    });
    setSavingHealth(false);
    setHealthSaved(true);
    setTimeout(() => setHealthSaved(false), 2000);
  }

  async function handleRetry() {
    setRetrying(true);
    setRetryMsg('');
    try {
      const res = await fetch(`/api/appointments/${appt.id}/retry`, { method: 'POST' });
      const data = await res.json();
      setRetryMsg(data.ok ? '✅ Call initiated!' : `❌ ${data.error}`);
    } catch { setRetryMsg('❌ Failed'); }
    finally { setRetrying(false); }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-4 flex items-start justify-between gap-4 cursor-pointer" onClick={handleExpand}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h4 className="font-semibold text-gray-900 truncate">{appt.patients?.name || 'Unknown'}</h4>
            <StatusBadge status={appt.status} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
            <span>🕐 {new Date(appt.scheduled_for).toLocaleString('en-PK', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            <span>📞 {formatForDisplay(appt.patients?.phone || '')}</span>
            {appt.reason && <span>📋 {appt.reason}</span>}
            {appt.patients?.diagnosis && <span className="text-violet-600">🏥 {appt.patients.diagnosis}</span>}
            {appt.contact_attempts > 0 && <span className="text-gray-400">{appt.contact_attempts} call{appt.contact_attempts > 1 ? 's' : ''}</span>}
          </div>
        </div>
        <span className="text-gray-400 text-sm mt-1 flex-shrink-0">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-5">

          {/* Health Profile */}
          <div>
            <h5 className="text-sm font-semibold text-gray-700 mb-2">🏥 Health Profile</h5>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Diagnosis</label>
                <input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="e.g. Hypertension" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Medications</label>
                <input value={medications} onChange={(e) => setMedications(e.target.value)}
                  placeholder="e.g. Concor 5mg" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <button onClick={handleSaveHealth} disabled={savingHealth}
                className="px-4 py-1.5 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 disabled:opacity-50 transition">
                {savingHealth ? 'Saving...' : 'Save Health Profile'}
              </button>
              {healthSaved && <span className="text-sm text-emerald-600">✅ Saved — bot will use this in the next call</span>}
            </div>
          </div>

          {/* Call Transcript */}
          <div>
            <h5 className="text-sm font-semibold text-gray-700 mb-2">📞 Call Transcript</h5>
            {loadingTranscript && <p className="text-sm text-gray-400">Loading...</p>}
            {transcript?.length === 0 && <p className="text-sm text-gray-400 italic">No calls recorded yet.</p>}
            {transcript && transcript.length > 0 && (
              <div className="space-y-3">
                {transcript.map((log, i) => {
                  const turns = log.transcript?.turns || [];
                  return (
                    <div key={i} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                        <span>Attempt {i + 1} — {new Date(log.created_at).toLocaleString('en-PK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        <span className={`px-2 py-0.5 rounded-full font-medium ${
                          log.outcome === 'confirm_yes' ? 'bg-emerald-100 text-emerald-700' :
                          log.outcome === 'reschedule'  ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-600'}`}>{log.outcome || log.status}</span>
                      </div>
                      {turns.length === 0 && <p className="text-xs text-gray-400 italic">No speech recorded.</p>}
                      <div className="space-y-1">
                        {turns.map((turn: any, j: number) => (
                          <div key={j} className={`flex ${turn.role === 'bot' ? 'justify-start' : 'justify-end'}`}>
                            <span className={`px-3 py-1.5 rounded-2xl text-sm max-w-xs ${
                              turn.role === 'bot' ? 'bg-blue-100 text-blue-900' : 'bg-emerald-100 text-emerald-900'}`}>
                              {turn.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Doctor Notes */}
          <div>
            <h5 className="text-sm font-semibold text-gray-700 mb-2">📝 Doctor Notes</h5>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Clinical notes, follow-up instructions..." rows={2}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            <div className="flex items-center gap-3 mt-2">
              <button onClick={handleSaveNotes} disabled={savingNotes}
                className="px-4 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 transition">
                {savingNotes ? 'Saving...' : 'Save Notes'}
              </button>
              {notesSaved && <span className="text-sm text-emerald-600">✅ Saved</span>}
            </div>
          </div>

          {/* Actions Row */}
          <div className="flex flex-wrap gap-3 pt-1">
            {canRetry && (
              <div>
                <button onClick={handleRetry} disabled={retrying}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition">
                  {retrying ? '⏳ Calling...' : '📞 Retry Call'}
                </button>
                {retryMsg && <p className="text-sm mt-1">{retryMsg}</p>}
              </div>
            )}
            <button
              onClick={() => onRebook(appt)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">
              📅 Re-book Follow-up
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────

export default function DashboardClient({ doctor, appointments, enrollments, stats }: Props) {
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [rebookAppt, setRebookAppt] = useState<any>(null);
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  function handleRebook(appt: any) {
    // Pre-fill add patient modal with same patient details
    setRebookAppt(appt);
    setShowAddPatient(true);
  }

  const filtered = appointments
    .filter((a) => filter === 'all' || a.status === filter)
    .filter((a) => !search || (a.patients?.name || '').toLowerCase().includes(search.toLowerCase()));

  const grouped: Record<string, typeof appointments> = {};
  for (const appt of filtered) {
    const dateKey = new Date(appt.scheduled_for).toLocaleDateString('en-PK', {
      weekday: 'long', month: 'short', day: 'numeric',
    });
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(appt);
  }

  const recoveryColor = stats.recoveryRate >= 70 ? 'text-emerald-600' : stats.recoveryRate >= 40 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50/30">
      {showAddPatient && (
        <AddPatientModal
          onClose={() => { setShowAddPatient(false); setRebookAppt(null); }}
          onSuccess={() => { setShowAddPatient(false); setRebookAppt(null); router.refresh(); }}
        />
      )}

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
            <button
              onClick={() => setShowAddPatient(true)}
              className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition">
              + Add Patient
            </button>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-600 transition">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">Total Patients</p>
            <p className="text-3xl font-bold text-gray-900">{stats.totalPatients}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">Pending Calls</p>
            <p className="text-3xl font-bold text-blue-600">{stats.upcoming}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">Confirmed</p>
            <p className="text-3xl font-bold text-emerald-600">{stats.confirmed}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">Needs Attention</p>
            <p className="text-3xl font-bold text-orange-600">{stats.needsAttention}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">Recovery Rate</p>
            <p className={`text-3xl font-bold ${recoveryColor}`}>{stats.recoveryRate}%</p>
          </div>
        </div>

        {stats.totalPatients < 5 && (
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
            <h2 className="text-lg font-bold mb-2">📱 Two ways to add patients</h2>
            <p className="text-emerald-100 text-sm leading-relaxed">
              <strong>1. Voice note:</strong> Send a WhatsApp voice note — <em>"Akhtar sahib, 0300-1234567, BP follow-up do hafte baad"</em><br />
              <strong>2. Dashboard:</strong> Click <strong>+ Add Patient</strong> above to fill a form directly.
            </p>
          </div>
        )}

        {/* Search + Filters */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">Appointments</h2>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search patient name..."
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[
              { key: 'all',         label: 'All' },
              { key: 'confirmed',   label: '✅ Confirmed' },
              { key: 'scheduled',   label: '⏳ Pending' },
              { key: 'no_response', label: '⚠️ Attention' },
              { key: 'unreachable', label: '📵 Unreachable' },
              { key: 'cancelled',   label: '❌ Cancelled' },
            ].map((tab) => (
              <button key={tab.key} onClick={() => setFilter(tab.key)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  filter === tab.key ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}>
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
            <p className="text-sm mt-1">Add a patient or send a voice note</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([dateLabel, appts]) => (
              <div key={dateLabel}>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{dateLabel}</h3>
                <div className="space-y-3">
                  {appts.map((appt) => (
                    <AppointmentCard key={appt.id} appt={appt} onRebook={handleRebook} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recent Enrollments */}
        {enrollments.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Recent Voice Enrollments</h2>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="divide-y divide-gray-50">
                {enrollments.map((e) => {
                  const data = e.extracted_data as any;
                  return (
                    <div key={e.id} className="px-4 py-3 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{data?.patient_name || 'Parsing...'}</p>
                        <p className="text-xs text-gray-500 truncate">{e.raw_transcript}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${
                        e.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700' :
                        e.status === 'needs_clarification' ? 'bg-yellow-50 text-yellow-700' :
                        e.status === 'cancelled' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'
                      }`}>{e.status}</span>
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
