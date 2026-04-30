'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart3, Users, Loader2, ScanLine, CalendarCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface AbsenterStats {
  user_id: string;
  name: string;
  email: string;
  role: string;
  total_scans: number;
  total_events: number;
}

export default function KinerjaAbsenterPage() {
  const [stats, setStats] = useState<AbsenterStats[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchKinerja = useCallback(async () => {
    setLoading(true);
    
    // Fetch all profiles that are absenters or admins
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .in('role', ['admin', 'absenter']);

    if (!profiles) {
      setLoading(false);
      return;
    }

    // Fetch absensi to count scans per recorded_by
    const { data: absensiData } = await supabase
      .from('absensi')
      .select('recorded_by, bimbingan_id');

    // Calculate
    const userStats: Record<string, { scans: number, eventsSet: Set<string> }> = {};
    profiles.forEach(p => {
      userStats[p.id] = { scans: 0, eventsSet: new Set() };
    });

    absensiData?.forEach(a => {
      if (userStats[a.recorded_by]) {
        userStats[a.recorded_by].scans += 1;
        userStats[a.recorded_by].eventsSet.add(a.bimbingan_id);
      }
    });

    const formattedStats: AbsenterStats[] = profiles.map(p => ({
      user_id: p.id,
      name: p.full_name,
      email: p.email,
      role: p.role,
      total_scans: userStats[p.id].scans,
      total_events: userStats[p.id].eventsSet.size
    }));

    // Sort by most scans
    formattedStats.sort((a, b) => b.total_scans - a.total_scans);

    setStats(formattedStats);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchKinerja();
  }, [fetchKinerja]);

  // Chart data (top 5 absenters)
  const chartData = stats.slice(0, 5).map(s => ({
    name: s.name.split(' ')[0], // first name only for chart
    scans: s.total_scans
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold gradient-text">Kinerja Absenter</h1>
        <p className="text-surface-200/50 text-sm mt-1">Analisis performa petugas absensi berdasarkan jumlah scan</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-6 h-[400px] flex flex-col">
          <h3 className="text-sm font-semibold text-surface-100 mb-6 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary-400" /> Top 5 Absenter Teraktif (Berdasarkan Scan)
          </h3>
          <div className="flex-1 w-full min-h-0">
            {loading ? (
              <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-primary-400" /></div>
            ) : chartData.some(d => d.scans > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" stroke="#e2e8f0" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{fill: '#1e293b', opacity: 0.4}}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f1f5f9' }}
                  />
                  <Bar dataKey="scans" name="Total Scan" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-surface-200/40 text-sm">Belum ada data scan</div>
            )}
          </div>
        </div>

        <div className="glass-card p-6 flex flex-col h-[400px]">
          <h3 className="text-sm font-semibold text-surface-100 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary-400" /> Rekapitulasi Petugas
          </h3>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary-400" /></div>
            ) : stats.length === 0 ? (
              <div className="text-center py-10 text-surface-200/40 text-sm">Tidak ada petugas</div>
            ) : (
              <div className="space-y-3">
                {stats.map((stat, idx) => (
                  <div key={stat.user_id} className="p-3 rounded-xl border border-surface-200/10 bg-surface-800/30 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-600 to-accent-violet flex items-center justify-center text-white font-medium text-xs flex-shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-surface-100 text-sm truncate">{stat.name}</p>
                        <p className="text-[10px] text-primary-400 capitalize">{stat.role}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-surface-100 flex items-center gap-1 justify-end">
                        {stat.total_scans} <ScanLine className="w-3 h-3 text-surface-200/50" />
                      </p>
                      <p className="text-xs text-surface-200/50 flex items-center gap-1 justify-end mt-0.5">
                        {stat.total_events} <CalendarCheck className="w-3 h-3" />
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
