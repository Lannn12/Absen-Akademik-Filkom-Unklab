'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Search, Loader2, GraduationCap, ChevronLeft, ChevronRight, Share2, CheckCircle2, Edit2, X, Save, AlertCircle, Trash2 } from 'lucide-react';
import type { Mahasiswa } from '@/types';
import { GENDER_OPTIONS } from '@/lib/constants';
import { useToast } from '@/app/components/ui/Toast';

export default function MahasiswaPage() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [mahasiswa, setMahasiswa] = useState<Mahasiswa[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const limit = 10;

  // Edit modal state
  const [editModal, setEditModal] = useState<{ open: boolean; mahasiswa: Mahasiswa | null }>({ open: false, mahasiswa: null });
  const [editFormData, setEditFormData] = useState({
    first_name: '',
    last_name: '',
    no_registrasi: '',
    program_study_code: '',
    gender: 'L' as 'L' | 'P',
    semester: 1,
    email: '',
  });
  
  const supabase = createClient();

  const handleCopyLink = () => {
    const link = `${window.location.origin}/cek-absen`;
    navigator.clipboard.writeText(`Silakan cek riwayat absensi Bimbingan Akademik Anda melalui link berikut:\n\n${link}\n\nMasukkan No. Registrasi (NIM) Anda untuk melihat data.`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fetchMahasiswa = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('mahasiswa')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,no_registrasi.ilike.%${search}%`);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (!error && data) {
      setMahasiswa(data as Mahasiswa[]);
      setTotal(count || 0);
    }
    setLoading(false);
  }, [supabase, search, page]);

  const openEditModal = (mhs: Mahasiswa) => {
    setEditModal({ open: true, mahasiswa: mhs });
    setEditFormData({
      first_name: mhs.first_name,
      last_name: mhs.last_name,
      no_registrasi: mhs.no_registrasi,
      program_study_code: mhs.program_study_code,
      gender: mhs.gender,
      semester: mhs.semester,
      email: mhs.email || '',
    });
    setError(null);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal.mahasiswa) return;

    setIsSubmitting(true);
    setError(null);

    // Validasi
    if (!editFormData.first_name || !editFormData.last_name || !editFormData.no_registrasi || !editFormData.program_study_code) {
      setError('Semua field wajib diisi kecuali email');
      setIsSubmitting(false);
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('mahasiswa')
        .update({
          first_name: editFormData.first_name,
          last_name: editFormData.last_name,
          no_registrasi: editFormData.no_registrasi,
          program_study_code: editFormData.program_study_code,
          gender: editFormData.gender,
          semester: editFormData.semester,
          email: editFormData.email || null,
        })
        .eq('id', editModal.mahasiswa.id);

      if (updateError) throw updateError;

      toastSuccess('Data mahasiswa berhasil diupdate!');
      setEditModal({ open: false, mahasiswa: null });
      fetchMahasiswa();
    } catch (err: any) {
      setError(err.message);
      toastError('Gagal mengupdate data mahasiswa');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (mhs: Mahasiswa) => {
    if (!window.confirm(`Yakin ingin menghapus mahasiswa ${mhs.first_name} ${mhs.last_name}?\n\nSemua data absensi terkait juga akan terhapus.`)) return;

    try {
      const { error: deleteError } = await supabase
        .from('mahasiswa')
        .delete()
        .eq('id', mhs.id);

      if (deleteError) throw deleteError;

      toastSuccess('Mahasiswa berhasil dihapus!');
      fetchMahasiswa();
    } catch (err: any) {
      toastError(err.message || 'Gagal menghapus mahasiswa');
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchMahasiswa();
    }, 300); // debounce search
    return () => clearTimeout(timeoutId);
  }, [fetchMahasiswa]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Data Mahasiswa</h1>
          <p className="text-surface-200/50 text-sm mt-1">Kelola data mahasiswa terdaftar ({total} total)</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button 
            onClick={handleCopyLink}
            className="btn-secondary whitespace-nowrap flex justify-center items-center gap-2"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            {copied ? 'Tersalin!' : 'Bagikan Link Absen Mahasiswa'}
          </button>
          
          <div className="relative w-full sm:w-72 group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/40 group-focus-within:text-primary-500 transition-colors" />
          <input
            type="text"
            placeholder="Cari nama atau no reg..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1); // reset to first page on search
            }}
            className="input-field pl-10 focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary-400 mb-2" />
              <p className="text-surface-200/50 text-sm">Memuat data...</p>
            </div>
          ) : mahasiswa.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              <div className="w-16 h-16 rounded-2xl bg-surface-800 flex items-center justify-center mb-4">
                <GraduationCap className="w-8 h-8 text-surface-200/20" />
              </div>
              <p className="text-surface-100 font-medium">Tidak ada data ditemukan</p>
              <p className="text-surface-200/50 text-sm mt-1">Coba gunakan kata kunci lain atau import data baru.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>No. Registrasi</th>
                  <th>Nama Lengkap</th>
                  <th>Kode Prodi</th>
                  <th>Tingkat</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {mahasiswa.map((mhs) => (
                  <tr key={mhs.id}>
                    <td className="font-mono text-xs text-primary-300">{mhs.no_registrasi}</td>
                    <td className="font-medium text-surface-100">
                      {mhs.first_name} {mhs.last_name}
                    </td>
                    <td>{mhs.program_study_code}</td>
                    <td>
                      <span className="badge border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan">
                        Tingkat {mhs.tingkat}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(mhs)}
                          className="p-2 text-surface-200/60 hover:text-primary-400 hover:bg-primary-500/10 rounded-lg transition-colors"
                          title="Edit Mahasiswa"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(mhs)}
                          className="p-2 text-surface-200/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Hapus Mahasiswa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="p-4 border-t border-surface-200/10 flex items-center justify-between">
            <p className="text-xs text-surface-200/50">
              Menampilkan {((page - 1) * limit) + 1}-{Math.min(page * limit, total)} dari {total} data
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-surface-200/10 text-surface-200 hover:bg-surface-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-surface-200/60 font-medium min-w-[3rem] text-center">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-surface-200/10 text-surface-200 hover:bg-surface-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Print Template removed as per UI cleanup */}

      {/* Edit Modal */}
      {editModal.open && editModal.mahasiswa && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditModal({ open: false, mahasiswa: null })} />
          <div className="relative glass-card w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6 border-b border-surface-200/10 pb-4">
              <h2 className="text-xl font-bold text-surface-100">Edit Data Mahasiswa</h2>
              <button onClick={() => setEditModal({ open: false, mahasiswa: null })} className="text-surface-200/40 hover:text-surface-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-200/80 mb-1.5">Nama Depan</label>
                  <input
                    type="text"
                    required
                    value={editFormData.first_name}
                    onChange={e => setEditFormData(p => ({ ...p, first_name: e.target.value }))}
                    className="input-field"
                    placeholder="Contoh: Budi"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-200/80 mb-1.5">Nama Belakang</label>
                  <input
                    type="text"
                    required
                    value={editFormData.last_name}
                    onChange={e => setEditFormData(p => ({ ...p, last_name: e.target.value }))}
                    className="input-field"
                    placeholder="Contoh: Santoso"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-200/80 mb-1.5">No. Registrasi (NIM)</label>
                  <input
                    type="text"
                    required
                    value={editFormData.no_registrasi}
                    onChange={e => setEditFormData(p => ({ ...p, no_registrasi: e.target.value }))}
                    className="input-field"
                    placeholder="Contoh: 2101234567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-200/80 mb-1.5">Kode Prodi</label>
                  <input
                    type="text"
                    required
                    value={editFormData.program_study_code}
                    onChange={e => setEditFormData(p => ({ ...p, program_study_code: e.target.value.toUpperCase() }))}
                    className="input-field"
                    placeholder="Contoh: IF"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-200/80 mb-1.5">Jenis Kelamin</label>
                  <select
                    required
                    value={editFormData.gender}
                    onChange={e => setEditFormData(p => ({ ...p, gender: e.target.value as 'L' | 'P' }))}
                    className="input-field"
                  >
                    {GENDER_OPTIONS.map(g => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-200/80 mb-1.5">Semester</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={14}
                    value={editFormData.semester}
                    onChange={e => setEditFormData(p => ({ ...p, semester: parseInt(e.target.value) || 1 }))}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-200/80 mb-1.5">Email (Opsional)</label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={e => setEditFormData(p => ({ ...p, email: e.target.value }))}
                  className="input-field"
                  placeholder="mahasiswa@university.ac.id"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-200/10 mt-6">
                <button type="button" onClick={() => setEditModal({ open: false, mahasiswa: null })} className="btn-secondary">
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
