'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Search, Loader2, ClipboardCheck, Users, Calendar, FileDown } from 'lucide-react';
import { exportToCSV } from '@/lib/utils';
import { TINGKAT_OPTIONS } from '@/lib/constants';
import type { Mahasiswa } from '@/types';

interface AttendanceData {
  mahasiswa_id: string;
  mahasiswa: Mahasiswa;
  total_wajib: number;
  total_hadir: number;
  total_valid: number;
}

export default function KehadiranPage() {
  const [data, setData] = useState<AttendanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTingkat, setFilterTingkat] = useState<string>('');

  const supabase = createClient();

  const fetchKehadiran = useCallback(async () => {
    setLoading(true);
    
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    
    const { data: profile } = await supabase.from('profiles').select('role, email').eq('id', userData.user.id).single();

    // 1. Fetch Mahasiswa
    let mhsQuery = supabase.from('mahasiswa').select('*').order('tingkat', { ascending: true });
    
    // If student, only fetch their own data
    if (profile?.role === 'mahasiswa') {
      mhsQuery = mhsQuery.eq('email', profile.email);
    }

    if (search) {
      mhsQuery = mhsQuery.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,no_registrasi.ilike.%${search}%`);
    }
    if (filterTingkat) {
      mhsQuery = mhsQuery.eq('tingkat', parseInt(filterTingkat));
    }

    const { data: mhsData } = await mhsQuery;
    if (!mhsData) {
      setLoading(false);
      return;
    }

    // 2. Fetch Events count per tingkat
    const { data: eventsData } = await supabase.from('bimbingan').select('tingkat_target');
    const eventCounts: Record<number, number> = {};
    eventsData?.forEach(e => {
      eventCounts[e.tingkat_target] = (eventCounts[e.tingkat_target] || 0) + 1;
    });

    // 3. Fetch Valid Absensi
    const mhsIds = mhsData.map(m => m.id);
    const { data: absensiData } = await supabase
      .from('absensi')
      .select('mahasiswa_id, status_valid')
      .in('mahasiswa_id', mhsIds);

    const absensiCounts: Record<string, { total: number, valid: number }> = {};
    mhsIds.forEach(id => absensiCounts[id] = { total: 0, valid: 0 });
    
    absensiData?.forEach(a => {
      if (absensiCounts[a.mahasiswa_id]) {
        absensiCounts[a.mahasiswa_id].total += 1;
        if (a.status_valid) absensiCounts[a.mahasiswa_id].valid += 1;
      }
    });

    // 4. Transform Data
    const attendanceData: AttendanceData[] = mhsData.map(mhs => {
      const total_wajib = eventCounts[mhs.tingkat] || 0;
      const total_hadir = absensiCounts[mhs.id].total;
      const total_valid = absensiCounts[mhs.id].valid;

      return {
        mahasiswa_id: mhs.id,
        mahasiswa: mhs as Mahasiswa,
        total_wajib,
        total_hadir,
        total_valid,
      };
    });

    setData(attendanceData);
    setLoading(false);
  }, [supabase, search, filterTingkat]);

  useEffect(() => {
    const timer = setTimeout(() => fetchKehadiran(), 300);
    return () => clearTimeout(timer);
  }, [fetchKehadiran]);

  // Statistics for summary cards
  const stats = {
    total: data.length,
    totalWajib: data.reduce((acc, curr) => acc + curr.total_wajib, 0),
    totalValid: data.reduce((acc, curr) => acc + curr.total_valid, 0),
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold gradient-text">Monitoring Kehadiran</h1>
        <p className="text-surface-200/50 text-sm mt-1">Pantau catatan kehadiran per mahasiswa</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <p className="text-xs text-surface-200/60 mb-1 flex items-center gap-1"><Users className="w-3 h-3" /> Total Mahasiswa</p>
          <p className="text-2xl font-bold text-surface-100">{stats.total}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-surface-200/60 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3 text-blue-400" /> Total Wajib Hadir</p>
          <p className="text-2xl font-bold text-blue-400">{stats.totalWajib}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-surface-200/60 mb-1 flex items-center gap-1"><ClipboardCheck className="w-3 h-3 text-emerald-400" /> Total Hadir (Valid)</p>
          <p className="text-2xl font-bold text-emerald-400">{stats.totalValid}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col sm:flex-row gap-4 items-end">
        <div className="w-full sm:w-1/3">
          <label className="block text-xs font-medium text-surface-200/60 mb-1.5">Pencarian</label>
          <div className="relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/40 group-focus-within:text-primary-500 transition-colors" />
            <input
              type="text"
              placeholder="Nama atau NIM..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10 py-2 text-sm focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
        </div>
        
        <div className="w-full sm:w-1/4">
          <label className="block text-xs font-medium text-surface-200/60 mb-1.5">Filter Tingkat</label>
          <select value={filterTingkat} onChange={(e) => setFilterTingkat(e.target.value)} className="input-field py-2 text-sm">
            <option value="">Semua Tingkat</option>
            {TINGKAT_OPTIONS.map(t => (
              <option key={t} value={t.toString()}>Tingkat {t}</option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-auto sm:ml-auto">
          <button 
            onClick={() => {
              const exportData = data.map(d => ({
                No_Registrasi: d.mahasiswa.no_registrasi,
                Nama: `${d.mahasiswa.first_name} ${d.mahasiswa.last_name}`,
                Prodi: d.mahasiswa.program_study_code,
                Tingkat: d.mahasiswa.tingkat,
                Wajib_Hadir: d.total_wajib,
                Hadir_Valid: d.total_valid,
              }));
              exportToCSV(exportData, `Laporan_Kehadiran_${new Date().toISOString().split('T')[0]}`);
            }}
            className="btn-secondary py-2 text-sm flex items-center justify-center gap-2 w-full"
          >
            <FileDown className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary-400 mb-2" />
              <p className="text-surface-200/50 text-sm">Memuat data kehadiran...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              <ClipboardCheck className="w-12 h-12 text-surface-200/20 mb-4" />
              <p className="text-surface-100 font-medium">Tidak ada data</p>
              <p className="text-surface-200/50 text-sm mt-1">Data dengan filter tersebut tidak ditemukan.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mahasiswa</th>
                  <th>Prodi / Tk.</th>
                  <th className="text-center">Wajib Hadir (Event)</th>
                  <th className="text-center">Kehadiran (Valid)</th>
                  <th className="text-center">Tidak Hadir / Belum Valid</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.mahasiswa_id}>
                    <td>
                      <p className="font-medium text-surface-100">{item.mahasiswa.first_name} {item.mahasiswa.last_name}</p>
                      <p className="font-mono text-xs text-primary-300 mt-0.5">{item.mahasiswa.no_registrasi}</p>
                    </td>
                    <td>
                      <p className="text-surface-200">{item.mahasiswa.program_study_code}</p>
                      <p className="text-xs text-surface-200/50 mt-0.5">Tingkat {item.mahasiswa.tingkat}</p>
                    </td>
                    <td className="text-center font-medium">{item.total_wajib}</td>
                    <td className="text-center font-medium text-emerald-400">{item.total_valid}</td>
                    <td className="text-center font-medium text-amber-400">
                      {Math.max(0, item.total_wajib - item.total_valid)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
