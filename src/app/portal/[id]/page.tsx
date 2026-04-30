'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Html5QrcodeScanner, Html5QrcodeScanType, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { ScanLine, CheckCircle2, AlertCircle, Clock, Loader2, ShieldCheck, UserCircle2, History } from 'lucide-react';
import type { Bimbingan, ScanResult, Mahasiswa } from '@/types';

export default function ScannerPortalPage() {
  const { id } = useParams();
  const router = useRouter();
  const [event, setEvent] = useState<Bimbingan | null>(null);
  const [pin, setPin] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Member selection
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  
  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [recentScans, setRecentScans] = useState<ScanResult[]>([]);
  const [processing, setProcessing] = useState(false);
  
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const supabase = createClient();
  const lastScanTime = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  const fetchEventData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('bimbingan')
      .select('*, absenter_group(*)')
      .eq('id', id)
      .single();
    
    if (error || !data) {
      setError('Event tidak ditemukan atau sudah berakhir.');
    } else {
      setEvent(data as Bimbingan);
      // Fetch members of the assigned group
      if (data.absenter_group_id) {
        const { data: members } = await supabase
          .from('absenter_members')
          .select('mahasiswa_id, mahasiswa(first_name, last_name, no_registrasi)')
          .eq('group_id', data.absenter_group_id);
        if (members) setGroupMembers(members);
      }
    }
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    fetchEventData();
  }, [fetchEventData]);

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (event?.access_pin && pin === event.access_pin) {
      setIsAuthorized(true);
    } else {
      alert('PIN Salah! Silakan hubungi Admin.');
    }
  };

  const onScanSuccess = useCallback(async (decodedText: string) => {
    const now = Date.now();
    if (lastScanTime.current.code === decodedText && now - lastScanTime.current.time < 3000) return;
    lastScanTime.current = { code: decodedText, time: now };
    
    if (processing || !selectedMemberId) return;
    setProcessing(true);
    
    try {
      const noRegistrasi = decodedText.trim();
      
      // 1. Get Mahasiswa
      const { data: mhsData, error: mhsError } = await supabase
        .from('mahasiswa')
        .select('*')
        .eq('no_registrasi', noRegistrasi)
        .single();

      if (mhsError || !mhsData) throw new Error(`Mahasiswa ${noRegistrasi} tidak ditemukan`);

      // 2. Validate Tingkat
      if (mhsData.tingkat !== event?.tingkat_target) {
        throw new Error(`Mahasiswa Tingkat ${mhsData.tingkat} tidak sesuai target Event (Tk ${event?.tingkat_target})`);
      }

      // 3. Check Attendance
      const { data: absensiData } = await supabase
        .from('absensi')
        .select('*')
        .eq('mahasiswa_id', mhsData.id)
        .eq('bimbingan_id', id)
        .maybeSingle();

      let newResult: ScanResult;

      if (!absensiData) {
        // CHECK IN
        const { error } = await supabase.from('absensi').insert({
          mahasiswa_id: mhsData.id,
          bimbingan_id: id,
          recorded_by_mhs_id: selectedMemberId // The BEM member's mahasiswa_id
        });
        if (error) throw error;
        newResult = { success: true, type: 'check_in', mahasiswa: mhsData, message: 'Check-In Berhasil', timestamp: new Date().toISOString() };
      } else if (!absensiData.check_out) {
        // CHECK OUT
        const diff = Math.floor((Date.now() - new Date(absensiData.check_in).getTime()) / 60000);
        const isValid = diff >= (event?.durasi_minimal || 0);
        const { error } = await supabase.from('absensi').update({
          check_out: new Date().toISOString(),
          status_valid: isValid
        }).eq('id', absensiData.id);
        if (error) throw error;
        newResult = { success: true, type: 'check_out', mahasiswa: mhsData, message: `Check-Out Berhasil (${diff} min) - ${isValid ? 'VALID' : 'TIDAK VALID'}`, timestamp: new Date().toISOString() };
      } else {
        throw new Error('Mahasiswa sudah melakukan Check-Out.');
      }

      setScanResult(newResult);
      setRecentScans(prev => [newResult, ...prev].slice(0, 10));
    } catch (err: any) {
      setScanResult({ success: false, type: 'check_in', message: err.message, timestamp: new Date().toISOString() });
    } finally {
      setProcessing(false);
    }
  }, [id, event, processing, selectedMemberId, supabase]);

  const startScanner = () => {
    if (!selectedMemberId) {
      alert('Pilih nama Anda terlebih dahulu');
      return;
    }
    setIsScanning(true);
    setTimeout(() => {
      scannerRef.current = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: 250, supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA] }, false);
      scannerRef.current.render(onScanSuccess, () => {});
    }, 100);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-surface-950 text-surface-200">Memuat Portal Petugas...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center bg-surface-950 text-red-400 p-6 text-center">{error}</div>;

  return (
    <div className="min-h-screen bg-surface-950 p-6 flex flex-col items-center">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary-600 flex items-center justify-center mx-auto mb-4">
            <ScanLine className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white uppercase tracking-tight">{event?.nama_kegiatan}</h1>
          <p className="text-surface-200/50 text-sm">Scanner Portal Petugas (BEM)</p>
        </div>

        {!isAuthorized ? (
          <div className="glass-card p-8 animate-in fade-in zoom-in duration-300">
            <div className="flex flex-col items-center mb-6">
              <ShieldCheck className="w-12 h-12 text-primary-400 mb-2" />
              <h2 className="text-lg font-semibold text-surface-100">Verifikasi Akses</h2>
              <p className="text-sm text-surface-200/50 text-center mt-1">Masukkan PIN yang diberikan oleh Admin untuk mulai memindai.</p>
            </div>
            <form onSubmit={handleVerifyPin} className="space-y-4">
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="PIN Keamanan"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="input-field text-center text-2xl tracking-[1em] py-4"
                autoFocus
              />
              <button type="submit" className="btn-primary w-full py-4 text-lg font-bold">BUKA PORTAL</button>
            </form>
          </div>
        ) : (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
             {!isScanning && (
               <div className="glass-card p-6">
                 <label className="block text-xs font-bold text-primary-400 uppercase tracking-widest mb-3">Siapa yang bertugas?</label>
                 <select 
                   value={selectedMemberId} 
                   onChange={(e) => setSelectedMemberId(e.target.value)}
                   className="input-field mb-6"
                 >
                   <option value="">-- Pilih Nama Anda --</option>
                   {groupMembers.map(m => (
                     <option key={m.mahasiswa_id} value={m.mahasiswa_id}>
                       {m.mahasiswa.first_name} {m.mahasiswa.last_name}
                     </option>
                   ))}
                 </select>
                 <button onClick={startScanner} disabled={!selectedMemberId} className="btn-primary w-full py-4 flex items-center justify-center gap-3">
                   <ScanLine className="w-6 h-6" /> MULAI SCANNING
                 </button>
               </div>
             )}

             {isScanning && (
               <div className="space-y-6">
                 <div className="relative rounded-2xl overflow-hidden bg-black border border-surface-200/20 aspect-square">
                    <div id="qr-reader" className="w-full h-full"></div>
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-48 h-48 border-2 border-primary-500/50 rounded-xl scanner-pulse"></div>
                    </div>
                 </div>

                 {scanResult && (
                    <div className={`p-4 rounded-xl border animate-in zoom-in duration-300 ${
                      scanResult.success 
                        ? scanResult.type === 'check_in' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-accent-cyan/10 border-accent-cyan/20 text-accent-cyan'
                        : 'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}>
                      <div className="flex gap-3">
                        {scanResult.success ? <CheckCircle2 className="w-6 h-6 mt-0.5" /> : <AlertCircle className="w-6 h-6 mt-0.5" />}
                        <div>
                          <p className="font-bold text-lg">{scanResult.success ? 'Berhasil!' : 'Gagal'}</p>
                          <p className="text-sm opacity-90">{scanResult.message}</p>
                          {scanResult.mahasiswa && <p className="text-xs font-medium mt-1 uppercase">{scanResult.mahasiswa.first_name} {scanResult.mahasiswa.last_name}</p>}
                        </div>
                      </div>
                    </div>
                 )}

                 <div className="flex flex-col gap-3">
                   <button onClick={() => { scannerRef.current?.clear(); setIsScanning(false); }} className="btn-secondary w-full py-3">TUTUP KAMERA</button>
                   
                   <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <UserCircle2 className="w-4 h-4 text-surface-200/40" />
                      </div>
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const input = (e.target as any).no_registrasi.value;
                        if (input) onScanSuccess(input);
                        (e.target as any).no_registrasi.value = '';
                      }} className="flex gap-2">
                        <input 
                          name="no_registrasi"
                          type="text" 
                          placeholder="Ketik NIM Manual..." 
                          className="input-field pl-10 text-sm"
                        />
                        <button type="submit" className="btn-primary px-4 py-2 text-xs shrink-0">INPUT</button>
                      </form>
                   </div>
                 </div>
                 
                 <div className="glass-card p-4">
                   <h3 className="text-xs font-bold text-surface-200/40 uppercase mb-3 flex items-center gap-2"><History className="w-3 h-3" /> Riwayat Terakhir</h3>
                   <div className="space-y-2 max-h-40 overflow-y-auto">
                      {recentScans.map((s, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs p-2 bg-surface-900 rounded-lg">
                          <span className="text-surface-100 truncate flex-1 mr-2">{s.mahasiswa?.first_name}</span>
                          <span className={s.success ? 'text-emerald-400' : 'text-red-400'}>{s.type === 'check_in' ? 'IN' : 'OUT'}</span>
                        </div>
                      ))}
                   </div>
                 </div>
               </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
}
