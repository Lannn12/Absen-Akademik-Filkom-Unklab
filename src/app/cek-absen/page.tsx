'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Search, Loader2, CheckCircle2, AlertCircle, Calendar, History } from 'lucide-react';

// Client khusus untuk halaman publik tanpa autentikasi (anon)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CekAbsenPage() {
  const [nim, setNim] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mahasiswa, setMahasiswa] = useState<any>(null);
  const [absensi, setAbsensi] = useState<any[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nim.trim()) return;

    setLoading(true);
    setError(null);
    setMahasiswa(null);
    setAbsensi([]);

    try {
      // 1. Cari data mahasiswa berdasarkan NIM
      const { data: mhs, error: mhsError } = await supabase
        .from('mahasiswa')
        .select('*')
        .ilike('no_registrasi', nim.trim())
        .single();

      if (mhsError || !mhs) {
        throw new Error('Mahasiswa tidak ditemukan. Periksa kembali No. Regis Anda.');
      }

      setMahasiswa(mhs);

      // 2. Ambil seluruh riwayat absensinya
      const { data: absData, error: absError } = await supabase
        .from('absensi')
        .select('*, bimbingan(nama_kegiatan, tanggal)')
        .eq('mahasiswa_id', mhs.id)
        .order('check_in', { ascending: false });

      if (absError) throw absError;

      setAbsensi(absData || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatJam = (timestamp: string | null) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  const formatTanggal = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-surface-950 p-4 sm:p-6 flex flex-col items-center">
      <div className="max-w-md w-full space-y-6 pt-6 sm:pt-12">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-900/50">
            <History className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-surface-100 mb-2">Portal Cek Absen</h1>
          <p className="text-surface-200/60 text-sm">Masukkan No. Regis Anda untuk melihat riwayat kehadiran Bimbingan Akademik</p>
        </div>

        <div className="glass-card p-6 shadow-xl border border-surface-200/10">
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-surface-200/40 uppercase tracking-widest mb-2">No. Registrasi</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-200/40" />
                <input
                  type="text"
                  placeholder="Ketik No. Regis..."
                  value={nim}
                  onChange={(e) => setNim(e.target.value)}
                  className="input-field pl-12 py-4 text-lg w-full bg-surface-900 focus:bg-surface-800 transition-colors"
                  autoFocus
                />
              </div>
            </div>
            <button type="submit" disabled={!nim.trim() || loading} className="w-full py-4 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'CARI RIWAYAT'}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-3 text-red-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}
        </div>

        {mahasiswa && (
          <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
            {/* Profil Singkat */}
            <div className="glass-card p-5 border-l-4 border-l-cyan-500">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-bold text-surface-100">{mahasiswa.first_name} {mahasiswa.last_name}</h2>
                  <p className="text-cyan-400 font-mono text-sm mt-1">{mahasiswa.no_registrasi}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-surface-200/50 uppercase tracking-widest block">Tingkat</span>
                  <span className="text-2xl font-black text-surface-100">{mahasiswa.tingkat}</span>
                </div>
              </div>
            </div>

            {/* Riwayat Absensi */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-surface-200/40 uppercase tracking-widest mt-6 mb-3 flex items-center gap-2">
                <History className="w-3 h-3" /> Daftar Kehadiran ({absensi.length})
              </h3>
              
              {absensi.length === 0 ? (
                <div className="glass-card p-8 text-center text-surface-200/50 text-sm">
                  Belum ada riwayat kehadiran yang tercatat.
                </div>
              ) : (
                absensi.map((abs) => (
                  <div key={abs.id} className="glass-card p-4 flex flex-col gap-3 hover:bg-surface-800/50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-surface-100">{abs.bimbingan?.nama_kegiatan || 'Event Dihapus'}</p>
                        <p className="text-xs text-surface-200/60 mt-1 flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          {abs.bimbingan?.tanggal ? formatTanggal(abs.bimbingan.tanggal) : '-'}
                        </p>
                      </div>
                      <div className="px-2.5 py-1 rounded border text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        HADIR
                      </div>
                    </div>
                    
                    <div className="mt-1 pt-3 border-t border-surface-200/10">
                      <div>
                        <p className="text-[10px] font-bold text-surface-200/40 uppercase tracking-wider mb-1">Waktu Absen</p>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <p className="text-sm font-mono text-surface-200">{formatJam(abs.check_in)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
