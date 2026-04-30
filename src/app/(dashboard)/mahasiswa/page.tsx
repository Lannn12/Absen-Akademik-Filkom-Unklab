'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Search, Loader2, GraduationCap, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Mahasiswa } from '@/types';

export default function MahasiswaPage() {
  const [mahasiswa, setMahasiswa] = useState<Mahasiswa[]>([]);
  const [selectedMhs, setSelectedMhs] = useState<Mahasiswa | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;
  
  const supabase = createClient();

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
        
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/40" />
          <input
            type="text"
            placeholder="Cari nama atau no reg..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1); // reset to first page on search
            }}
            className="input-field pl-9"
          />
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

      {/* Print Template (Hidden in UI, visible in Print) */}
      {selectedMhs && (
        <div className="id-card-print hidden flex-col items-center justify-between text-black bg-white p-4 border border-black" style={{ width: '8.5cm', height: '5.5cm', position: 'fixed', left: 0, top: 0, zIndex: 9999 }}>
          <div className="text-center w-full border-b pb-2 mb-2">
            <h2 className="text-[10px] font-bold uppercase tracking-widest">Kartu Mahasiswa</h2>
            <p className="text-[7px] opacity-70">Smart Academic Guidance System</p>
          </div>
          <div className="flex gap-4 items-center w-full mb-auto">
            <div className="w-16 h-20 bg-gray-100 rounded flex items-center justify-center text-[7px] text-gray-400 border border-gray-200">
              FOTO
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase leading-tight">{selectedMhs.first_name} {selectedMhs.last_name}</p>
              <p className="text-[9px] font-mono mt-0.5 text-blue-800 font-bold">{selectedMhs.no_registrasi}</p>
              <p className="text-[8px] mt-2 font-semibold">{selectedMhs.program_study_code}</p>
              <p className="text-[8px] opacity-80">Tingkat {selectedMhs.tingkat}</p>
            </div>
          </div>
          <div className="w-full flex flex-col items-center border-t pt-2">
             <img 
               src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${selectedMhs.no_registrasi}`} 
               alt="QR Code" 
               className="w-12 h-12"
             />
             <p className="text-[7px] mt-1 font-mono">{selectedMhs.no_registrasi}</p>
          </div>
        </div>
      )}
    </div>
  );
}
