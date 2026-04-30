'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { ScanLine, CheckCircle2, AlertCircle, Loader2, ShieldCheck, UserCircle2, History, Keyboard } from 'lucide-react';

interface PortalEvent {
  id: string;
  nama_kegiatan: string;
  tanggal: string;
  tingkat_target: number;
  durasi_minimal: number;
  status: string;
  has_pin: boolean;
}

interface GroupMember {
  mahasiswa_id: string;
  mahasiswa: {
    id: string;
    first_name: string;
    last_name: string;
    no_registrasi: string;
  };
}

interface ScanResultData {
  success: boolean;
  type?: string;
  message: string;
  mahasiswa?: {
    first_name: string;
    last_name: string;
    no_registrasi: string;
    tingkat: number;
  };
}

export default function ScannerPortalPage() {
  const { id } = useParams();
  const [event, setEvent] = useState<PortalEvent | null>(null);
  const [pin, setPin] = useState('');
  const [verifiedPin, setVerifiedPin] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pinError, setPinError] = useState('');

  // Member selection
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResultData | null>(null);
  const [recentScans, setRecentScans] = useState<ScanResultData[]>([]);
  const [processing, setProcessing] = useState(false);
  const [manualNim, setManualNim] = useState('');

  const scannerRef = useRef<any>(null);
  const lastScanTime = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  // Fetch event data via API (bypasses RLS)
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await fetch(`/api/portal/${id}`);
        const data = await res.json();
        if (res.ok) {
          setEvent(data.event);
          setGroupMembers(data.members || []);
          // If no PIN is set, auto-authorize
          if (!data.event.has_pin) {
            setIsAuthorized(true);
          }
        } else {
          setError(data.error || 'Event tidak ditemukan');
        }
      } catch {
        setError('Gagal memuat data event. Periksa koneksi internet Anda.');
      }
      setLoading(false);
    };
    fetchEvent();
  }, [id]);

  // Verify PIN via API
  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    try {
      const res = await fetch(`/api/portal/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (data.authorized) {
        setVerifiedPin(pin);
        setIsAuthorized(true);
      } else {
        setPinError('PIN Salah! Hubungi Admin Anda.');
      }
    } catch {
      setPinError('Gagal verifikasi. Periksa koneksi internet.');
    }
  };

  // Record attendance via API
  const recordAttendance = useCallback(async (noRegistrasi: string) => {
    const now = Date.now();
    if (lastScanTime.current.code === noRegistrasi && now - lastScanTime.current.time < 3000) return;
    lastScanTime.current = { code: noRegistrasi, time: now };

    if (processing) return;
    setProcessing(true);

    try {
      const res = await fetch(`/api/portal/${id}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_registrasi: noRegistrasi,
          member_id: selectedMemberId,
          pin: verifiedPin,
        }),
      });
      const data = await res.json();
      const result: ScanResultData = {
        success: data.success,
        type: data.type,
        message: data.message,
        mahasiswa: data.mahasiswa,
      };
      setScanResult(result);
      setRecentScans(prev => [result, ...prev].slice(0, 15));
    } catch {
      setScanResult({ success: false, message: 'Koneksi gagal. Coba lagi.' });
    } finally {
      setProcessing(false);
    }
  }, [id, selectedMemberId, verifiedPin, processing]);

  // Start QR scanner
  const startScanner = useCallback(async () => {
    if (!selectedMemberId) {
      alert('Pilih nama Anda terlebih dahulu');
      return;
    }
    setIsScanning(true);
    setScanResult(null);

    // Dynamically import to avoid SSR issues
    const { Html5QrcodeScanner, Html5QrcodeScanType } = await import('html5-qrcode');

    setTimeout(() => {
      scannerRef.current = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 }, supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA] },
        false
      );
      scannerRef.current.render(
        (decodedText: string) => recordAttendance(decodedText.trim()),
        () => {}
      );
    }, 200);
  }, [selectedMemberId, recordAttendance]);

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(() => {});
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualNim.trim()) {
      recordAttendance(manualNim.trim());
      setManualNim('');
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-950">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary-400 mx-auto mb-3" />
          <p className="text-surface-200/50 text-sm">Memuat Portal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-950 p-6">
        <div className="glass-card p-8 text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-surface-100 mb-2">Oops!</h2>
          <p className="text-surface-200/60 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-950 p-4 sm:p-6 flex flex-col items-center">
      <div className="max-w-md w-full space-y-5">
        {/* Header */}
        <div className="text-center pt-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center mx-auto mb-3">
            <ScanLine className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-lg font-bold text-white">{event?.nama_kegiatan}</h1>
          <p className="text-surface-200/40 text-xs mt-1">Target: Tingkat {event?.tingkat_target} • Min. {event?.durasi_minimal} menit</p>
        </div>

        {/* PIN Screen */}
        {!isAuthorized ? (
          <div className="glass-card p-8 animate-in fade-in zoom-in duration-300">
            <div className="flex flex-col items-center mb-6">
              <ShieldCheck className="w-14 h-14 text-primary-400 mb-3" />
              <h2 className="text-lg font-semibold text-surface-100">Verifikasi Akses</h2>
              <p className="text-xs text-surface-200/50 text-center mt-1">Masukkan PIN yang diberikan Admin</p>
            </div>
            <form onSubmit={handleVerifyPin} className="space-y-4">
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="• • • • • •"
                value={pin}
                onChange={(e) => { setPin(e.target.value); setPinError(''); }}
                className="input-field text-center text-3xl tracking-[0.5em] py-5 font-mono"
                autoFocus
              />
              {pinError && (
                <p className="text-red-400 text-xs text-center flex items-center justify-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {pinError}
                </p>
              )}
              <button type="submit" disabled={pin.length < 4} className="btn-primary w-full py-4 text-base font-bold disabled:opacity-30">
                BUKA PORTAL
              </button>
            </form>
          </div>
        ) : (
          /* Scanner Screen */
          <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
            {/* Member Selector */}
            {!isScanning && (
              <div className="glass-card p-5">
                <label className="block text-[10px] font-bold text-primary-400 uppercase tracking-widest mb-2">Siapa yang bertugas?</label>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="input-field mb-4"
                >
                  <option value="">-- Pilih Nama Anda --</option>
                  {groupMembers.map(m => (
                    <option key={m.mahasiswa_id} value={m.mahasiswa_id}>
                      {m.mahasiswa.first_name} {m.mahasiswa.last_name} ({m.mahasiswa.no_registrasi})
                    </option>
                  ))}
                </select>
                <button onClick={startScanner} disabled={!selectedMemberId} className="btn-primary w-full py-4 flex items-center justify-center gap-3 disabled:opacity-30">
                  <ScanLine className="w-5 h-5" /> MULAI SCANNING
                </button>
              </div>
            )}

            {/* Active Scanner */}
            {isScanning && (
              <div className="space-y-4">
                {/* Camera View */}
                <div className="relative rounded-2xl overflow-hidden bg-black border border-surface-200/10">
                  <div id="qr-reader" className="w-full"></div>
                </div>

                {/* Manual Input */}
                <form onSubmit={handleManualSubmit} className="glass-card p-4">
                  <label className="block text-[10px] font-bold text-surface-200/40 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <Keyboard className="w-3 h-3" /> Input Manual
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ketik NIM..."
                      value={manualNim}
                      onChange={(e) => setManualNim(e.target.value)}
                      className="input-field text-sm"
                    />
                    <button type="submit" disabled={!manualNim.trim() || processing} className="btn-primary px-5 py-2 text-xs shrink-0 disabled:opacity-30">
                      {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'KIRIM'}
                    </button>
                  </div>
                </form>

                {/* Scan Result */}
                {scanResult && (
                  <div className={`p-4 rounded-xl border animate-in zoom-in duration-200 ${
                    scanResult.success
                      ? scanResult.type === 'check_in' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-cyan-500/10 border-cyan-500/20'
                      : 'bg-red-500/10 border-red-500/20'
                  }`}>
                    <div className="flex gap-3">
                      {scanResult.success
                        ? <CheckCircle2 className={`w-6 h-6 mt-0.5 shrink-0 ${scanResult.type === 'check_in' ? 'text-emerald-400' : 'text-cyan-400'}`} />
                        : <AlertCircle className="w-6 h-6 mt-0.5 shrink-0 text-red-400" />
                      }
                      <div>
                        <p className={`font-bold text-base ${scanResult.success ? (scanResult.type === 'check_in' ? 'text-emerald-400' : 'text-cyan-400') : 'text-red-400'}`}>
                          {scanResult.success ? (scanResult.type === 'check_in' ? 'CHECK-IN ✓' : 'CHECK-OUT ✓') : 'GAGAL ✗'}
                        </p>
                        {scanResult.mahasiswa && (
                          <p className="text-surface-100 text-sm font-medium">{scanResult.mahasiswa.first_name} {scanResult.mahasiswa.last_name}</p>
                        )}
                        <p className="text-surface-200/50 text-xs mt-0.5">{scanResult.message}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Controls */}
                <button onClick={stopScanner} className="btn-secondary w-full py-3 text-sm">TUTUP KAMERA</button>

                {/* Recent Scans */}
                {recentScans.length > 0 && (
                  <div className="glass-card p-4">
                    <h3 className="text-[10px] font-bold text-surface-200/40 uppercase tracking-widest mb-3 flex items-center gap-1">
                      <History className="w-3 h-3" /> Riwayat ({recentScans.length})
                    </h3>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {recentScans.map((s, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs p-2.5 bg-surface-900/80 rounded-lg">
                          <span className="text-surface-100 truncate flex-1 mr-2 font-medium">
                            {s.mahasiswa ? `${s.mahasiswa.first_name} ${s.mahasiswa.last_name}` : '-'}
                          </span>
                          <span className={`font-bold text-[10px] px-2 py-0.5 rounded ${
                            s.success
                              ? s.type === 'check_in' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-cyan-500/10 text-cyan-400'
                              : 'bg-red-500/10 text-red-400'
                          }`}>
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
