'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { bimbinganSchema } from '@/lib/validators';
import { Calendar, Plus, Loader2, Trash2, Users, Clock, AlertCircle, CheckCircle2, X, Save } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { TINGKAT_OPTIONS } from '@/lib/constants';
import { useToast } from '@/app/components/ui/Toast';
import type { Bimbingan, AbsenterGroup } from '@/types';

export default function BimbinganPage() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [events, setEvents] = useState<Bimbingan[]>([]);
  const [groups, setGroups] = useState<AbsenterGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nama_kegiatan: '',
    tanggal: '',
    tingkat_target: 1,
    durasi_minimal: 30,
    absenter_group_id: '',
  });

  const supabase = createClient();

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('bimbingan')
      .select('*, absenter_group(*)')
      .order('tanggal', { ascending: false });

    if (!error && data) {
      setEvents(data as Bimbingan[]);
    }
    setLoading(false);
  }, [supabase]);

  const fetchGroups = useCallback(async () => {
    const { data } = await supabase.from('absenter_group').select('*').order('nama_group');
    if (data) setGroups(data as AbsenterGroup[]);
  }, [supabase]);

  useEffect(() => {
    fetchEvents();
    fetchGroups();
  }, [fetchEvents, fetchGroups]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const validation = bimbinganSchema.safeParse(formData);
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      setIsSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase
      .from('bimbingan')
      .insert([validation.data]);

    if (insertError) {
      setError(insertError.message);
    } else {
      setShowModal(false);
      setFormData({
        nama_kegiatan: '',
        tanggal: '',
        tingkat_target: 1,
        durasi_minimal: 30,
        absenter_group_id: '',
      });
      fetchEvents();
    }
    setIsSubmitting(false);
  };

  const handleUpdateStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'closed' : 'active';
    await supabase.from('bimbingan').update({ status: newStatus }).eq('id', id);
    fetchEvents();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus event bimbingan ini? Data absensi terkait juga akan terhapus.')) return;
    const { error } = await supabase.from('bimbingan').delete().eq('id', id);
    if (!error) {
      toastSuccess('Event bimbingan berhasil dihapus');
      fetchEvents();
    } else {
      toastError('Gagal menghapus event');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Event Bimbingan</h1>
          <p className="text-surface-200/50 text-sm mt-1">Kelola jadwal kegiatan bimbingan akademik</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Event Baru</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full flex flex-col items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary-400 mb-2" />
            <p className="text-surface-200/50 text-sm">Memuat event...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="col-span-full glass-card p-12 flex flex-col items-center justify-center text-center border-dashed border-2 border-surface-200/20">
            <div className="w-16 h-16 rounded-2xl bg-surface-800 flex items-center justify-center mb-4">
              <Calendar className="w-8 h-8 text-surface-200/20" />
            </div>
            <p className="text-surface-100 font-medium text-lg">Belum ada event</p>
            <p className="text-surface-200/50 text-sm mt-1 max-w-sm mx-auto mb-6">
              Buat jadwal bimbingan pertama untuk mulai mencatat kehadiran mahasiswa.
            </p>
            <button onClick={() => setShowModal(true)} className="btn-secondary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Buat Event
            </button>
          </div>
        ) : (
          events.map(event => (
            <div key={event.id} className="glass-card flex flex-col hover:border-primary-500/30 transition-colors group">
              <div className="p-5 flex-1">
                <div className="flex items-start justify-between mb-4">
                  <span className={`badge ${event.status === 'active' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-surface-200/20 bg-surface-800 text-surface-200/60'}`}>
                    {event.status === 'active' ? 'Berjalan' : 'Selesai'}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleUpdateStatus(event.id, event.status)}
                      className="p-1.5 text-surface-200/40 hover:text-primary-400 hover:bg-primary-500/10 rounded-md transition-colors"
                      title={event.status === 'active' ? 'Tutup Event' : 'Buka Kembali Event'}
                    >
                      {event.status === 'active' ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    </button>
                    <button 
                      onClick={() => handleDelete(event.id)}
                      className="p-1.5 text-surface-200/40 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                      title="Hapus Event"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-surface-100 mb-2 line-clamp-2">{event.nama_kegiatan}</h3>
                
                <div className="space-y-2 mt-4 text-sm text-surface-200/70">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary-400/60" />
                    <span>{formatDate(event.tanggal)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary-400/60" />
                    <span>Target: Tingkat {event.tingkat_target}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary-400/60" />
                    <span>Minimal {event.durasi_minimal} menit</span>
                  </div>
                </div>
              </div>
              
              <div className="px-5 py-3 border-t border-surface-200/10 bg-surface-800/30 flex items-center justify-between mt-auto">
                <span className="text-xs text-surface-200/50">Absenter Group:</span>
                <span className="text-xs font-medium text-surface-100 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-accent-cyan" />
                  {event.absenter_group?.nama_group || 'Tidak ada'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Buat Event */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative glass-card w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6 border-b border-surface-200/10 pb-4">
              <h2 className="text-xl font-bold text-surface-100">Buat Event Bimbingan</h2>
              <button onClick={() => setShowModal(false)} className="text-surface-200/40 hover:text-surface-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-200/80 mb-1.5">Nama Kegiatan</label>
                <input
                  type="text"
                  required
                  value={formData.nama_kegiatan}
                  onChange={e => setFormData(p => ({ ...p, nama_kegiatan: e.target.value }))}
                  className="input-field"
                  placeholder="Contoh: Bimbingan Akademik Semester Genap"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-200/80 mb-1.5">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={formData.tanggal}
                    onChange={e => setFormData(p => ({ ...p, tanggal: e.target.value }))}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-200/80 mb-1.5">Tingkat Target</label>
                  <select
                    required
                    value={formData.tingkat_target}
                    onChange={e => setFormData(p => ({ ...p, tingkat_target: Number(e.target.value) }))}
                    className="input-field"
                  >
                    {TINGKAT_OPTIONS.map(t => (
                      <option key={t} value={t}>Tingkat {t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-200/80 mb-1.5">Durasi Minimal Kehadiran (Menit)</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="480"
                  value={formData.durasi_minimal}
                  onChange={e => setFormData(p => ({ ...p, durasi_minimal: Number(e.target.value) }))}
                  className="input-field"
                  placeholder="30"
                />
                <p className="text-xs text-surface-200/40 mt-1.5">Waktu minimal antara check-in dan check-out untuk dianggap valid.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-200/80 mb-1.5">Petugas Absensi (Group)</label>
                <select
                  required
                  value={formData.absenter_group_id}
                  onChange={e => setFormData(p => ({ ...p, absenter_group_id: e.target.value }))}
                  className="input-field"
                >
                  <option value="">-- Pilih Group --</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.nama_group}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-200/10 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Simpan Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
