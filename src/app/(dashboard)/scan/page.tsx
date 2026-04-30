'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Html5QrcodeScanner, Html5QrcodeScanType, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { ScanLine, CheckCircle2, AlertCircle, Clock, Loader2, Play, Square, History } from 'lucide-react';
import { useToast } from '@/app/components/ui/Toast';
import type { Bimbingan, ScanResult } from '@/types';

export default function ScanPage() {
  const { toast, error: toastError } = useToast();
  const [events, setEvents] = useState<Bimbingan[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [recentScans, setRecentScans] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const supabase = createClient();
  const lastScanTime = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get user profile
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    
    let query = supabase.from('bimbingan').select('*, absenter_group(*)').eq('status', 'active');
    
    // If not admin, only show events assigned to their groups
    if (profile?.role !== 'admin') {
      const { data: groups } = await supabase.from('absenter_members').select('group_id').eq('user_id', user.id);
      if (groups && groups.length > 0) {
        query = query.in('absenter_group_id', groups.map(g => g.group_id));
      } else {
        // User has no groups
        setEvents([]);
        setLoading(false);
        return;
      }
    }

    const { data } = await query.order('tanggal', { ascending: true });
    if (data) setEvents(data as Bimbingan[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Handle successful scan
  const onScanSuccess = useCallback(async (decodedText: string) => {
    // Prevent duplicate scans within 3 seconds
    const now = Date.now();
    if (lastScanTime.current.code === decodedText && now - lastScanTime.current.time < 3000) {
      return;
    }
    lastScanTime.current = { code: decodedText, time: now };
    
    if (processing || !selectedEventId) return;
    
    setProcessing(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const noRegistrasi = decodedText.trim();
      const selectedEvent = events.find(e => e.id === selectedEventId);
      
      if (!selectedEvent) throw new Error('Event tidak valid');

      // 1. Validasi Mahasiswa
      const { data: mhsData, error: mhsError } = await supabase
        .from('mahasiswa')
        .select('*')
        .eq('no_registrasi', noRegistrasi)
        .single();

      if (mhsError || !mhsData) {
        throw new Error(`Mahasiswa dengan No. Reg ${noRegistrasi} tidak ditemukan`);
      }

      // 2. Validasi Tingkat
      if (mhsData.tingkat !== selectedEvent.tingkat_target) {
        throw new Error(`Mahasiswa Tingkat ${mhsData.tingkat} tidak dapat menghadiri event untuk Tingkat ${selectedEvent.tingkat_target}`);
      }

      // 3. Cek Absensi Existing
      const { data: absensiData } = await supabase
        .from('absensi')
        .select('*')
        .eq('mahasiswa_id', mhsData.id)
        .eq('bimbingan_id', selectedEventId)
        .maybeSingle();

      let newResult: ScanResult;

      if (!absensiData) {
        // BELUM ABSEN -> CHECK IN
        const { error: insertError } = await supabase
          .from('absensi')
          .insert({
            mahasiswa_id: mhsData.id,
            bimbingan_id: selectedEventId,
            recorded_by: user.id
          });

        if (insertError) throw insertError;

        newResult = {
          success: true,
          type: 'check_in',
          mahasiswa: mhsData,
          message: 'Berhasil Check-In',
          timestamp: new Date().toISOString()
        };
      } else if (!absensiData.check_out) {
        // SUDAH CHECK IN, BELUM CHECK OUT -> CHECK OUT
        // Hitung selisih menit untuk status valid
        const checkInTime = new Date(absensiData.check_in).getTime();
        const currentTime = new Date().getTime();
        const diffMinutes = Math.floor((currentTime - checkInTime) / 60000);
        
        const isValid = diffMinutes >= selectedEvent.durasi_minimal;

        const { error: updateError } = await supabase
          .from('absensi')
          .update({
            check_out: new Date().toISOString(),
            status_valid: isValid
          })
          .eq('id', absensiData.id);

        if (updateError) throw updateError;

        newResult = {
          success: true,
          type: 'check_out',
          mahasiswa: mhsData,
          message: `Berhasil Check-Out (Durasi: ${diffMinutes} menit) - ${isValid ? 'VALID' : 'TIDAK VALID'}`,
          timestamp: new Date().toISOString()
        };
      } else {
        // SUDAH CHECK OUT
        throw new Error('Mahasiswa sudah melakukan check-out sebelumnya.');
      }

      setScanResult(newResult);
      setRecentScans(prev => [newResult, ...prev].slice(0, 10));

    } catch (error: unknown) {
      const errorResult: ScanResult = {
        success: false,
        type: 'check_in',
        message: (error as Error).message || 'Terjadi kesalahan sistem',
        timestamp: new Date().toISOString()
      };
      setScanResult(errorResult);
    } finally {
      setProcessing(false);
    }
  }, [selectedEventId, events, processing, supabase]);

  const startScanner = () => {
    if (!selectedEventId) {
      toastError('Pilih event bimbingan terlebih dahulu');
      return;
    }

    setIsScanning(true);
    setScanResult(null);

    // Provide a short delay to allow UI to render the div
    setTimeout(() => {
      scannerRef.current = new Html5QrcodeScanner(
        "qr-reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.CODE_128]
        },
        false
      );
      
      scannerRef.current.render(onScanSuccess, () => {
        // Ignore background scan errors
      });
    }, 100);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(e => console.error(e));
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => console.error(e));
      }
    };
  }, []);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold gradient-text">Scan Absensi</h1>
        <p className="text-surface-200/50 text-sm mt-1">Gunakan kamera untuk memindai barcode ID Card mahasiswa</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Scanner Panel */}
        <div className="lg:col-span-3 space-y-4">
          <div className="glass-card p-6">
            <div className="mb-6">
              <label className="block text-sm font-medium text-surface-200/80 mb-2">Pilih Event Bimbingan Aktif</label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                disabled={isScanning || loading}
                className="input-field"
              >
                <option value="">-- Pilih Event --</option>
                {events.map(event => (
                  <option key={event.id} value={event.id}>
                    {event.nama_kegiatan} (Target: Tk {event.tingkat_target}) - {new Date(event.tanggal).toLocaleDateString('id-ID')}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-surface-900 border border-surface-200/10 min-h-[400px] flex flex-col items-center justify-center">
              {isScanning ? (
                <div className="w-full">
                  <div id="qr-reader" className="w-full rounded-2xl overflow-hidden border-none" style={{ border: 'none' }}></div>
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-64 h-64 border-2 border-primary-500/50 rounded-xl scanner-pulse"></div>
                  </div>
                </div>
              ) : (
                <div className="text-center p-8">
                  <div className="w-20 h-20 rounded-full bg-surface-800 flex items-center justify-center mx-auto mb-4">
                    <ScanLine className="w-10 h-10 text-surface-200/20" />
                  </div>
                  <p className="text-surface-200/50 text-sm max-w-xs mx-auto">
                    Kamera belum aktif. Pastikan event telah dipilih dan klik tombol mulai di bawah.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-center">
              {!isScanning ? (
                <button 
                  onClick={startScanner}
                  disabled={!selectedEventId}
                  className="btn-primary flex items-center gap-2 px-8 py-3 text-base"
                >
                  <Play className="w-5 h-5 fill-current" />
                  Mulai Scanner
                </button>
              ) : (
                <button 
                  onClick={stopScanner}
                  className="btn-danger flex items-center gap-2 px-8 py-3 text-base"
                >
                  <Square className="w-5 h-5 fill-current" />
                  Hentikan Scanner
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Current Scan Result */}
          <div className="glass-card p-6 min-h-[180px]">
            <h3 className="text-sm font-semibold text-surface-100 mb-4 flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-primary-400" />
              Hasil Scan Terakhir
            </h3>

            {processing ? (
              <div className="flex flex-col items-center justify-center py-6 text-primary-400">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <span className="text-sm font-medium">Memproses data...</span>
              </div>
            ) : scanResult ? (
              <div className={`p-4 rounded-xl border ${
                scanResult.success 
                  ? scanResult.type === 'check_in' 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-accent-cyan/10 border-accent-cyan/20 text-accent-cyan'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}>
                <div className="flex items-start gap-3">
                  {scanResult.success ? <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5" /> : <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />}
                  <div>
                    <h4 className="font-bold text-lg mb-1">{scanResult.success ? (scanResult.type === 'check_in' ? 'Check-In Berhasil' : 'Check-Out Berhasil') : 'Scan Gagal'}</h4>
                    {scanResult.mahasiswa && (
                      <div className="text-surface-100 mb-2">
                        <p className="font-medium text-base">{scanResult.mahasiswa.first_name} {scanResult.mahasiswa.last_name}</p>
                        <p className="text-sm opacity-80">{scanResult.mahasiswa.no_registrasi} - Tk. {scanResult.mahasiswa.tingkat}</p>
                      </div>
                    )}
                    <p className="text-sm opacity-90">{scanResult.message}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-10 text-surface-200/30 text-sm">
                Belum ada data scan
              </div>
            )}
          </div>

          {/* Recent Scans List */}
          <div className="glass-card p-6 flex-1 flex flex-col">
            <h3 className="text-sm font-semibold text-surface-100 mb-4 flex items-center gap-2">
              <History className="w-4 h-4 text-primary-400" />
              Riwayat Scan Terbaru
            </h3>
            
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
              {recentScans.length === 0 ? (
                <div className="text-center py-8 text-surface-200/30 text-xs">Kosong</div>
              ) : (
                recentScans.map((scan, idx) => (
                  <div key={idx} className={`p-3 rounded-lg border text-sm flex items-start gap-3 ${
                    scan.success ? 'bg-surface-800/50 border-surface-200/10' : 'bg-red-500/5 border-red-500/10'
                  }`}>
                    <div className="shrink-0 mt-0.5">
                      {scan.success ? (
                        scan.type === 'check_in' ? <Clock className="w-4 h-4 text-emerald-400" /> : <Clock className="w-4 h-4 text-accent-cyan" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-surface-100 truncate">
                        {scan.mahasiswa ? `${scan.mahasiswa.first_name} ${scan.mahasiswa.last_name}` : 'Unknown'}
                      </p>
                      <p className={`text-xs truncate ${scan.success ? 'text-surface-200/50' : 'text-red-400/80'}`}>
                        {scan.message}
                      </p>
                      <p className="text-[10px] text-surface-200/30 mt-1">
                        {new Date(scan.timestamp).toLocaleTimeString('id-ID')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
