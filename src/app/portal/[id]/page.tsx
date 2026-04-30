'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { ScanLine, CheckCircle2, AlertCircle, Loader2, ShieldCheck, History, Keyboard } from 'lucide-react';

// Create a standalone Supabase client (no auth needed)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ScanResultData {
  success: boolean;
  type?: string;
  message: string;
  mahasiswa?: { first_name: string; last_name: string; no_registrasi: string; tingkat: number };
}

export default function ScannerPortalPage() {
  const { id } = useParams();
  const [event, setEvent] = useState<any>(null);
  const [pin, setPin] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pinError, setPinError] = useState('');

  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');

  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResultData | null>(null);
  const [recentScans, setRecentScans] = useState<ScanResultData[]>([]);
  const [processing, setProcessing] = useState(false);
  const [manualNim, setManualNim] = useState('');

  const scannerRef = useRef<any>(null);
  const lastScanTime = useRef({ code: '', time: 0 });

  // Fetch event data directly from Supabase
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('bimbingan')
          .select('*, absenter_group(id, nama_group)')
          .eq('id', id)
          .single();

        if (fetchError || !data) {
          setError('Event tidak ditemukan atau link tidak valid.');
          setLoading(false);
          return;
        }

        setEvent(data);

        // If no PIN, auto-authorize
        if (!data.access_pin) {
          setIsAuthorized(true);
        }

        // Fetch group members
        if (data.absenter_group_id) {
          const { data: members } = await supabase
            .from('absenter_members')
            .select('mahasiswa_id, mahasiswa(id, first_name, last_name, no_registrasi)')
            .eq('group_id', data.absenter_group_id);
          if (members) setGroupMembers(members);
        }
      } catch (err: any) {
        setError(`Error: ${err.message}`);
      }
      setLoading(false);
    };
    fetchEvent();
  }, [id]);

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (event?.access_pin && pin === event.access_pin) {
      setIsAuthorized(true);
      setPinError('');
    } else {
      setPinError('PIN Salah! Hubungi Admin.');
    }
  };

  const recordAttendance = useCallback(async (noRegistrasi: string) => {
    const now = Date.now();
    if (lastScanTime.current.code === noRegistrasi && now - lastScanTime.current.time < 3000) return;
    lastScanTime.current = { code: noRegistrasi, time: now };
    if (processing) return;
    setProcessing(true);

    try {
      // Find mahasiswa
      const { data: mhs } = await supabase
        .from('mahasiswa')
        .select('*')
        .eq('no_registrasi', noRegistrasi.trim())
        .single();

      if (!mhs) throw new Error(`NIM ${noRegistrasi} tidak ditemukan`);
      if (mhs.tingkat !== event?.tingkat_target) {
        throw new Error(`Tingkat ${mhs.tingkat} tidak sesuai target Tk ${event?.tingkat_target}`);
      }

      // Check existing
      const { data: existing } = await supabase
        .from('absensi')
        .select('*')
        .eq('mahasiswa_id', mhs.id)
        .eq('bimbingan_id', id)
        .maybeSingle();

      const mhsInfo = { first_name: mhs.first_name, last_name: mhs.last_name, no_registrasi: mhs.no_registrasi, tingkat: mhs.tingkat };
      let result: ScanResultData;

      if (!existing) {
        const insertData: any = { mahasiswa_id: mhs.id, bimbingan_id: id };
        if (selectedMemberId) insertData.recorded_by_mhs_id = selectedMemberId;
        const { error } = await supabase.from('absensi').insert(insertData);
        if (error) throw new Error(error.message);
        result = { success: true, type: 'check_in', message: 'Check-In Berhasil', mahasiswa: mhsInfo };
      } else if (!existing.check_out) {
        const diff = Math.floor((Date.now() - new Date(existing.check_in).getTime()) / 60000);
        const isValid = diff >= (event?.durasi_minimal || 0);
        const { error } = await supabase.from('absensi').update({ check_out: new Date().toISOString(), status_valid: isValid }).eq('id', existing.id);
        if (error) throw new Error(error.message);
        result = { success: true, type: 'check_out', message: `Check-Out (${diff} min) - ${isValid ? 'VALID' : 'TIDAK VALID'}`, mahasiswa: mhsInfo };
      } else {
        throw new Error('Mahasiswa sudah Check-Out sebelumnya');
      }

      setScanResult(result);
      setRecentScans(prev => [result, ...prev].slice(0, 15));
    } catch (err: any) {
      const errResult: ScanResultData = { success: false, message: err.message };
      setScanResult(errResult);
      setRecentScans(prev => [errResult, ...prev].slice(0, 15));
    } finally {
      setProcessing(false);
    }
  }, [id, event, processing, selectedMemberId]);

  const startScanner = useCallback(async () => {
    setIsScanning(true);
    setScanResult(null);
    const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
    
    setTimeout(() => {
      // Create instance directly, no built-in UI
      scannerRef.current = new Html5Qrcode("qr-reader");
      
      const config = {
        fps: 30, // Sangat cepat
        // Tidak menggunakan qrbox agar seluruh layar kamera mencari barcode (lebih mudah untuk barcode buram/tidak jelas)
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.CODABAR,
        ],
      };

      // Langsung paksa mulai dengan kamera belakang (environment)
      scannerRef.current.start(
        { facingMode: "environment" },
        config,
        (text: string) => recordAttendance(text.trim()),
        () => { } // ignore scan errors (it errors every frame a barcode isn't found)
      ).catch((err: any) => {
        console.error("Kamera gagal dimulai:", err);
        alert("Gagal mengakses kamera belakang. Pastikan Anda memberikan izin kamera.");
        setIsScanning(false);
      });
    }, 200);
  }, [selectedMemberId, recordAttendance]);

  const stopScanner = () => {
    if (scannerRef.current) { 
      scannerRef.current.stop().then(() => {
        scannerRef.current.clear();
        scannerRef.current = null;
      }).catch(() => {});
    }
    setIsScanning(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualNim.trim()) { recordAttendance(manualNim.trim()); setManualNim(''); }
  };

  useEffect(() => { return () => { if (scannerRef.current) scannerRef.current.clear().catch(() => { }); }; }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950">
      <div className="text-center"><Loader2 className="w-10 h-10 animate-spin text-primary-400 mx-auto mb-3" /><p className="text-surface-200/50 text-sm">Memuat Portal...</p></div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 p-6">
      <div className="glass-card p-8 text-center max-w-sm">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-surface-100 mb-2">Oops!</h2>
        <p className="text-surface-200/60 text-sm">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-950 p-4 sm:p-6 flex flex-col items-center">
      <div className="max-w-md w-full space-y-5">
        <div className="text-center pt-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center mx-auto mb-3">
            <ScanLine className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-lg font-bold text-white">{event?.nama_kegiatan}</h1>
          <p className="text-surface-200/40 text-xs mt-1">Target: Tingkat {event?.tingkat_target} • Min. {event?.durasi_minimal} menit</p>
        </div>

        {!isAuthorized ? (
          <div className="glass-card p-8 animate-in fade-in zoom-in duration-300">
            <div className="flex flex-col items-center mb-6">
              <ShieldCheck className="w-14 h-14 text-primary-400 mb-3" />
              <h2 className="text-lg font-semibold text-surface-100">Verifikasi Akses</h2>
              <p className="text-xs text-surface-200/50 text-center mt-1">Masukkan PIN yang diberikan Admin</p>
            </div>
            <form onSubmit={handleVerifyPin} className="space-y-4">
              <input type="password" inputMode="numeric" maxLength={6} placeholder="• • • • • •" value={pin}
                onChange={(e) => { setPin(e.target.value); setPinError(''); }}
                className="input-field text-center text-3xl tracking-[0.5em] py-5 font-mono" autoFocus />
              {pinError && <p className="text-red-400 text-xs text-center flex items-center justify-center gap-1"><AlertCircle className="w-3 h-3" /> {pinError}</p>}
              <button type="submit" disabled={pin.length < 4} className="btn-primary w-full py-4 text-base font-bold disabled:opacity-30">BUKA PORTAL</button>
            </form>
          </div>
        ) : (
          <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
            {!isScanning && (
              <div className="glass-card p-5 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                <p className="text-surface-100 font-semibold mb-1">Akses Diberikan</p>
                <p className="text-surface-200/50 text-xs mb-5">Siap memindai ID Card mahasiswa</p>
                <button onClick={startScanner} className="btn-primary w-full py-4 flex items-center justify-center gap-3">
                  <ScanLine className="w-5 h-5" /> MULAI SCANNING
                </button>
              </div>
            )}

            {isScanning && (
              <div className="space-y-4">
                <div className="relative rounded-2xl overflow-hidden bg-black border border-surface-200/10">
                  <div id="qr-reader" className="w-full"></div>
                </div>

                <form onSubmit={handleManualSubmit} className="glass-card p-4">
                  <label className="block text-[10px] font-bold text-surface-200/40 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <Keyboard className="w-3 h-3" /> Input Manual
                  </label>
                  <div className="flex gap-2">
                    <input type="text" placeholder="Ketik No Regis" value={manualNim} onChange={(e) => setManualNim(e.target.value)} className="input-field text-sm" />
                    <button type="submit" disabled={!manualNim.trim() || processing} className="btn-primary px-5 py-2 text-xs shrink-0 disabled:opacity-30">
                      {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'KIRIM'}
                    </button>
                  </div>
                </form>

                {scanResult && (
                  <div className={`p-4 rounded-xl border animate-in zoom-in duration-200 ${scanResult.success ? (scanResult.type === 'check_in' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-cyan-500/10 border-cyan-500/20') : 'bg-red-500/10 border-red-500/20'
                    }`}>
                    <div className="flex gap-3">
                      {scanResult.success ? <CheckCircle2 className={`w-6 h-6 mt-0.5 shrink-0 ${scanResult.type === 'check_in' ? 'text-emerald-400' : 'text-cyan-400'}`} /> : <AlertCircle className="w-6 h-6 mt-0.5 shrink-0 text-red-400" />}
                      <div>
                        <p className={`font-bold text-base ${scanResult.success ? (scanResult.type === 'check_in' ? 'text-emerald-400' : 'text-cyan-400') : 'text-red-400'}`}>
                          {scanResult.success ? (scanResult.type === 'check_in' ? 'CHECK-IN ✓' : 'CHECK-OUT ✓') : 'GAGAL ✗'}
                        </p>
                        {scanResult.mahasiswa && <p className="text-surface-100 text-sm font-medium">{scanResult.mahasiswa.first_name} {scanResult.mahasiswa.last_name}</p>}
                        <p className="text-surface-200/50 text-xs mt-0.5">{scanResult.message}</p>
                      </div>
                    </div>
                  </div>
                )}

                <button onClick={stopScanner} className="btn-secondary w-full py-3 text-sm">TUTUP KAMERA</button>

                {recentScans.length > 0 && (
                  <div className="glass-card p-4">
                    <h3 className="text-[10px] font-bold text-surface-200/40 uppercase tracking-widest mb-3 flex items-center gap-1"><History className="w-3 h-3" /> Riwayat ({recentScans.length})</h3>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {recentScans.map((s, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs p-2.5 bg-surface-900/80 rounded-lg">
                          <span className="text-surface-100 truncate flex-1 mr-2 font-medium">{s.mahasiswa ? `${s.mahasiswa.first_name} ${s.mahasiswa.last_name}` : '-'}</span>
                          <span className={`font-bold text-[10px] px-2 py-0.5 rounded ${s.success ? (s.type === 'check_in' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-cyan-500/10 text-cyan-400') : 'bg-red-500/10 text-red-400'}`}>
                            {s.success ? (s.type === 'check_in' ? 'IN' : 'OUT') : 'FAIL'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
