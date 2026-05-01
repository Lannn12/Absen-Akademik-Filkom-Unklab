'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Users, Calendar, ClipboardCheck, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TINGKAT_OPTIONS } from '@/lib/constants';
import ThreeDBarChart from './ThreeDBarChart';

interface Stats {
  totalMahasiswa: number;
  totalEvents: number;
  totalAbsensi: number;
}

interface TingkatData {
  name: string;
  hadir: number;
  tidakHadir: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ 
    totalMahasiswa: 0, totalEvents: 0, totalAbsensi: 0 
  });
  const [tingkatChartData, setTingkatChartData] = useState<TingkatData[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchStats = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from('profiles').select('role, email').eq('id', user.id).single();
      const isMahasiswa = profile?.role === 'mahasiswa';

      // Fetch basic counts
      let mhsQuery = supabase.from('mahasiswa').select('*');
      let absensiQuery = supabase.from('absensi').select('mahasiswa_id, status_valid, bimbingan_id');

      if (isMahasiswa) {
        mhsQuery = mhsQuery.eq('email', profile.email);
      }

      const [mhsResponse, eventsResponse, absensiResponse] = await Promise.all([
        mhsQuery,
        supabase.from('bimbingan').select('*'),
        absensiQuery,
      ]);

      let mhs = mhsResponse.data || [];
      const events = eventsResponse.data || [];
      let absensi = absensiResponse.data || [];

      if (isMahasiswa && mhs.length > 0) {
        const myMhsId = mhs[0].id;
        absensi = absensi.filter(a => a.mahasiswa_id === myMhsId);
      }

      // Calculate Event Targets per Tingkat
      const eventCountsPerTingkat: Record<number, number> = {};
      events.forEach(e => {
        eventCountsPerTingkat[e.tingkat_target] = (eventCountsPerTingkat[e.tingkat_target] || 0) + 1;
      });

      // Calculate Attendance per Mahasiswa
      const validAbsensiPerMhs: Record<string, number> = {};
      absensi.forEach(a => {
        if (a.status_valid) {
          validAbsensiPerMhs[a.mahasiswa_id] = (validAbsensiPerMhs[a.mahasiswa_id] || 0) + 1;
        }
      });

      // Group for Bar Chart
      const tkStats: Record<number, { hadir: number, totalMhs: number, eventCount: number }> = {};
      TINGKAT_OPTIONS.forEach(t => tkStats[t] = { hadir: 0, totalMhs: 0, eventCount: eventCountsPerTingkat[t] || 0 });

      mhs.forEach(m => {
        const tk = m.tingkat;
        tkStats[tk].totalMhs += 1;
        
        const totalHadir = validAbsensiPerMhs[m.id] || 0;
        tkStats[tk].hadir += totalHadir;
      });

      // Format Bar Chart Data
      const tData: TingkatData[] = Object.keys(tkStats)
        .map(Number)
        .filter(tk => tkStats[tk].totalMhs > 0)
        .map(tk => {
          const expectedTotalHadir = tkStats[tk].totalMhs * tkStats[tk].eventCount;
          const actualHadir = tkStats[tk].hadir;
          return {
            name: `Tk. ${tk}`,
            hadir: actualHadir,
            tidakHadir: expectedTotalHadir - actualHadir
          };
        });

      setTingkatChartData(tData);
      setStats({
        totalMahasiswa: mhs.length,
        totalEvents: events.length,
        totalAbsensi: absensi.length
      });
      setLoading(false);
    };
    fetchStats();

    // Subscribe to realtime updates on absensi table
    const channel = supabase
      .channel('absensi_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'absensi' }, () => {
        fetchStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const statCards = [
    { label: 'Total Mahasiswa', value: stats.totalMahasiswa, icon: Users, color: 'indigo', desc: 'Terdaftar' },
    { label: 'Total Event', value: stats.totalEvents, icon: Calendar, color: 'cyan', desc: 'Bimbingan' },
    { label: 'Total Absensi', value: stats.totalAbsensi, icon: ClipboardCheck, color: 'emerald', desc: 'Total Scan' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold gradient-text">Dashboard Analitik</h1>
        <p className="text-surface-200/50 text-sm mt-1">Ringkasan sistem absensi bimbingan akademik</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className={`glass-card stat-card ${card.color} p-5 hover:scale-[1.02] transition-transform`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-surface-200/60 font-medium">{card.label}</span>
              <div className={`p-2 rounded-lg bg-${card.color}-500/10`}>
                <card.icon className={`w-5 h-5 text-${card.color}-400`} />
              </div>
            </div>
            <div className="text-3xl font-bold text-surface-100 tracking-tight">{card.value}</div>
            <p className="text-xs text-surface-200/40 mt-1 font-medium">{card.desc}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6">
        <div className="glass-card p-6 flex flex-col h-[500px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-surface-100 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-primary-400" /> Kehadiran per Tingkat (3D Rotatable)
            </h3>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="text-surface-200/60">Valid Hadir</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                <span className="text-surface-200/60">Absen/Tidak Valid</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-surface-200/50 mb-4">* Anda bisa menggeser (drag/swipe) grafik di bawah ini untuk melihat dari berbagai sudut (360 derajat)</p>
          <div className="flex-1 w-full h-full min-h-0 bg-surface-900 rounded-xl overflow-hidden cursor-move border border-surface-200/10">
            {tingkatChartData.length > 0 ? (
              <ThreeDBarChart data={tingkatChartData} />
            ) : (
              <div className="flex items-center justify-center h-full text-surface-200/40 text-sm">Belum ada data</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
