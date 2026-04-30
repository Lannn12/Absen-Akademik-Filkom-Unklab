'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Search, Loader2, ShieldCheck, AlertTriangle, XOctagon, FileDown } from 'lucide-react';
import { getComplianceStatus, getComplianceLabel, getComplianceColor, exportToCSV } from '@/lib/utils';
import { TINGKAT_OPTIONS } from '@/lib/constants';
import type { Mahasiswa, ComplianceData } from '@/types';

export default function KepatuhanPage() {
  const [data, setData] = useState<ComplianceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTingkat, setFilterTingkat] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  const supabase = createClient();

  const fetchKepatuhan = useCallback(async () => {
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

    // 4. Calculate Compliance
    let complianceData: ComplianceData[] = mhsData.map(mhs => {
      const total_wajib = eventCounts[mhs.tingkat] || 0;
      const total_hadir = absensiCounts[mhs.id].total;
      const total_valid = absensiCounts[mhs.id].valid;
      
      const persentase = total_wajib === 0 ? 0 : Math.round((total_valid / total_wajib) * 100);
      const status = getComplianceStatus(persentase);

      return {
        mahasiswa_id: mhs.id,
        mahasiswa: mhs as Mahasiswa,
        total_wajib,
        total_hadir,
        total_valid,
        persentase,
        status
      };
    });

    // 5. Apply Status Filter
    if (filterStatus) {
      complianceData = complianceData.filter(d => d.status === filterStatus);
    }

    setData(complianceData);
    setLoading(false);
  }, [supabase, search, filterTingkat, filterStatus]);

  useEffect(() => {
    const timer = setTimeout(() => fetchKepatuhan(), 300);
    return () => clearTimeout(timer);
  }, [fetchKepatuhan]);

  // Statistics for summary cards
  const stats = {
    total: data.length,
    patuh: data.filter(d => d.status === 'patuh').length,
    perhatian: data.filter(d => d.status === 'perlu_perhatian').length,
    tidakPatuh: data.filter(d => d.status === 'tidak_patuh').length,
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold gradient-text">Monitoring Kepatuhan</h1>
        <p className="text-surface-200/50 text-sm mt-1">Pantau persentase kehadiran valid per mahasiswa</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <p className="text-xs text-surface-200/60 mb-1">Total Mahasiswa</p>
          <p className="text-2xl font-bold text-surface-100">{stats.total}</p>
        </div>
        <div className="glass-card p-4 border-b-2 border-b-emerald-500/50">
          <p className="text-xs text-surface-200/60 mb-1 flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-emerald-400" /> Patuh (≥80%)</p>
          <p className="text-2xl font-bold text-emerald-400">{stats.patuh}</p>
        </div>
        <div className="glass-card p-4 border-b-2 border-b-amber-500/50">
          <p className="text-xs text-surface-200/60 mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-400" /> Perhatian (50-79%)</p>
          <p className="text-2xl font-bold text-amber-400">{stats.perhatian}</p>
        </div>
        <div className="glass-card p-4 border-b-2 border-b-red-500/50">
          <p className="text-xs text-surface-200/60 mb-1 flex items-center gap-1"><XOctagon className="w-3 h-3 text-red-400" /> Tidak Patuh (&lt;50%)</p>
          <p className="text-2xl font-bold text-red-400">{stats.tidakPatuh}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col sm:flex-row gap-4 items-end">
        <div className="w-full sm:w-1/3">
          <label className="block text-xs font-medium text-surface-200/60 mb-1.5">Pencarian</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/40" />
            <input
              type="text"
              placeholder="Nama atau NIM..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-9 py-2 text-sm"
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

        <div className="w-full sm:w-1/4">
          <label className="block text-xs font-medium text-surface-200/60 mb-1.5">Filter Status</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-field py-2 text-sm">
            <option value="">Semua Status</option>
            <option value="patuh">Patuh (≥80%)</option>
            <option value="perlu_perhatian">Perlu Perhatian (50-79%)</option>
            <option value="tidak_patuh">Tidak Patuh (&lt;50%)</option>
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
                Wajib: d.total_wajib,
                Hadir_Valid: d.total_valid,
                Persentase: `${d.persentase}%`,
                Status: getComplianceLabel(d.status)
              }));
              exportToCSV(exportData, `Laporan_Kepatuhan_${new Date().toISOString().split('T')[0]}`);
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
              <p className="text-surface-200/50 text-sm">Menghitung data kepatuhan...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              <ShieldCheck className="w-12 h-12 text-surface-200/20 mb-4" />
              <p className="text-surface-100 font-medium">Tidak ada data</p>
              <p className="text-surface-200/50 text-sm mt-1">Data dengan filter tersebut tidak ditemukan.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mahasiswa</th>
                  <th>Prodi / Tk.</th>
                  <th className="text-center">Wajib Hadir</th>
                  <th className="text-center">Hadir (Valid)</th>
                  <th>Persentase</th>
                  <th>Status</th>
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
                    <td className="text-center font-medium">{item.total_wajib} Event</td>
                    <td className="text-center font-medium text-primary-400">{item.total_valid} Kali</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-surface-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-1000"
                            style={{ 
                              width: `${item.persentase}%`,
                              backgroundColor: item.persentase >= 80 ? '#10b981' : item.persentase >= 50 ? '#f59e0b' : '#ef4444' 
                            }}
                          />
                        </div>
                        <span className="text-sm font-bold">{item.persentase}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${getComplianceColor(item.status)}`}>
                        {getComplianceLabel(item.status)}
                      </span>
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
