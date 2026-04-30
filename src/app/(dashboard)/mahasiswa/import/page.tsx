'use client';

import { useState, useRef } from 'react';
import { read, utils } from 'xlsx';
import { createClient } from '@/lib/supabase/client';
import { excelRowSchema, type ExcelRowInput } from '@/lib/validators';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, Trash2, Save, Loader2 } from 'lucide-react';
import { useToast } from '@/app/components/ui/Toast';
import type { ImportPreview, ImportError } from '@/types';

export default function ImportPage() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const allowedExtensions = ['.xlsx', '.xls', '.csv', '.pdf'];
    const isAllowed = allowedExtensions.some(ext => selectedFile.name.toLowerCase().endsWith(ext));

    if (!isAllowed) {
      toastError('Hanya file Excel (.xlsx, .xls), CSV (.csv), atau PDF (.pdf) yang diperbolehkan');
      return;
    }

    setFile(selectedFile);
    if (selectedFile.name.toLowerCase().endsWith('.pdf')) {
      await processPdfFile(selectedFile);
    } else {
      await processExcelFile(selectedFile);
    }
  };

  const processPdfFile = async (file: File) => {
    setIsProcessing(true);
    setSaveStatus(null);
    
    try {
      // Load pdf.js from CDN dynamically if not already loaded
      if (!(window as any).pdfjsLib) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';
          script.type = 'module';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      // We need to import the library as a module to get the pdfjsLib
      // In latest versions of pdf.js, it's better to use the global provided by the module
      const pdfjsLib = (window as any).pdfjsLib;
      if (!pdfjsLib) {
         // Fallback if global is not set (some module versions behave differently)
         throw new Error('Gagal memuat library PDF dari server cloud. Mohon periksa koneksi internet Anda.');
      }
      
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;

      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }

      // Pattern: [NIM/Reg] [Name...] [Optional Prodi] [Optional Semester]
      // Matches standard student lists where NIM is 7-10 digits
      const rows = fullText.split('\n').filter(line => line.trim().length > 0);
      const extractedData: Record<string, any>[] = [];

      rows.forEach(line => {
        // Simple heuristic: Line starting with or containing a 7-10 digit number
        const nimMatch = line.match(/(\d{7,10})/);
        if (nimMatch) {
          const nim = nimMatch[1];
          // Remove the NIM from the line to extract the name
          let remaining = line.replace(nim, '').trim();
          
          // Heuristic: Name is usually the longest alphabetical part
          // We'll just take the line as is and clean it up
          // This is a basic parser - can be refined
          extractedData.push({
            no_registrasi: nim,
            first_name: remaining.split(' ')[0] || 'Mahasiswa',
            last_name: remaining.split(' ').slice(1).join(' ') || '-',
            program_study_code: 'TI', // Default if not found
            semester: 1
          });
        }
      });

      if (extractedData.length === 0) {
        throw new Error('Tidak ditemukan data mahasiswa yang valid dalam PDF. Pastikan PDF berisi teks (bukan hasil scan gambar).');
      }

      await processRawData(extractedData);

    } catch (error: any) {
      console.error('PDF processing error:', error);
      toastError(error.message || 'Gagal memproses file PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const processRawData = async (rawData: any[]) => {
    const validRows: ExcelRowInput[] = [];
    const errors: ImportError[] = [];

    rawData.forEach((row, index) => {
      const rowNumber = index + 1;
      
      const rawSemester = String(row.SEMESTER || row.semester || '0');
      const semesterValue = parseInt(rawSemester) || 1;

      const prodiCode = String(row.PROGRAM_STUDY_CODE || row.program_study_code || 'TI').toUpperCase();
      
      const mappedRow = {
        no_registrasi: String(row.no_registrasi || ''),
        first_name: String(row.first_name || ''),
        last_name: String(row.last_name || '-'),
        program_study_code: String(row.program_study_code || 'TI').toUpperCase(),
        semester: parseInt(String(row.semester)) || 1,
        email: row.email ? String(row.email).toLowerCase() : undefined,
      };

      const result = excelRowSchema.safeParse(mappedRow);

      if (result.success) {
        const isDuplicateInBatch = validRows.some(r => r.no_registrasi === result.data.no_registrasi);
        if (isDuplicateInBatch) {
          errors.push({
            row: rowNumber,
            field: 'no_registrasi',
            message: 'Duplikat No Registrasi',
          });
        } else {
          validRows.push(result.data);
        }
      } else {
        result.error.issues.forEach(issue => {
          errors.push({
            row: rowNumber,
            field: String(issue.path[0]),
            message: issue.message,
          });
        });
      }
    });

    setPreview({
      valid: validRows,
      errors,
      total: rawData.length,
    });
  };

  const processExcelFile = async (file: File) => {
    setIsProcessing(true);
    setSaveStatus(null);
    
    try {
      const data = await file.arrayBuffer();
      const workbook = read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData = utils.sheet_to_json(firstSheet) as Record<string, unknown>[];
      
      // Use common processing logic
      const processedData = rawData.map((row, index) => {
        const rowNumber = index + 2;
        const rawSemester = String(row.SEMESTER || row.semester || '0');
        const rawTingkat = parseInt(String(row.TINGKAT || row.tingkat || row.Tingkat || '0'));
        
        const semesterMatch = rawSemester.match(/_(\d+)$/);
        let semesterValue = semesterMatch ? parseInt(semesterMatch[1]) : (parseInt(rawSemester) || 1);

        // Smart Mapping: If TINGKAT is provided and semester is default (1), use TINGKAT to set semester
        if (rawTingkat > 0 && (semesterValue === 1 || !row.SEMESTER)) {
          semesterValue = (rawTingkat * 2) - 1; // Tingkat 3 -> Semester 5, Tingkat 2 -> Semester 3
        }

        const prodiCode = String(row.PROGRAM_STUDY_CODE || row.program_study_code || '').toUpperCase();
        const prodiNum = prodiCode === 'TI' ? '1' : (prodiCode === 'SI' ? '3' : (prodiCode === 'DKV' ? '2' : '0'));
        const yearPrefix = rawSemester.startsWith('20') ? rawSemester.substring(2, 4) : '25';
        const autoReg = `s${yearPrefix}${prodiNum}${String(rowNumber).padStart(5, '0')}`;

        return {
          ...row,
          no_registrasi: String(row.no_registrasi || row.NO_REGISTRASI || row.NIM || row.nim || row.STUDENT_REG_NUMBER || row.student_reg_number || autoReg),
          first_name: String(row.FIRST_NAME || row.first_name || row.nama_depan || ''),
          last_name: String(row.LAST_NAME || row.last_name || row.nama_belakang || '-'),
          program_study_code: prodiCode || 'TI',
          semester: semesterValue
        };
      });

      await processRawData(processedData);

      // Data processing handled by processRawData


    } catch (error) {
      console.error('Excel processing error:', error);
      toastError('Gagal memproses file Excel. Pastikan format sesuai.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!preview || preview.valid.length === 0) return;
    
    setIsSaving(true);
    setSaveStatus(null);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      // The tingkat is auto-calculated by the database GENERATED ALWAYS AS column.
      // So we only insert the fields needed.
      const { error } = await supabase
        .from('mahasiswa')
        .insert(preview.valid);

      if (error) {
        if (error.code === '23505') { // Unique violation
          throw new Error('Beberapa data mahasiswa sudah ada di database (No Registrasi duplikat).');
        }
        throw error;
      }

      toastSuccess(`Berhasil menyimpan ${preview.valid.length} data mahasiswa.`);
      
      setSaveStatus({
        success: true,
        message: `Berhasil menyimpan ${preview.valid.length} data mahasiswa.`,
      });
      
      // Clear after success
      setFile(null);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (error: unknown) {
      setSaveStatus({
        success: false,
        message: (error as Error).message || 'Gagal menyimpan data ke database.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetData = async () => {
    if (!window.confirm('PERHATIAN: Ini akan menghapus SELURUH data mahasiswa secara permanen. Anda yakin?')) return;
    
    setIsProcessing(true);
    // Delete all by using a dummy filter that matches everything (e.g. email not null or id exists)
    const { error } = await supabase
      .from('mahasiswa')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (!error) {
      toastSuccess('Seluruh data mahasiswa telah dihapus.');
      setFile(null);
      setPreview(null);
    } else {
      toastError('Gagal menghapus data: ' + error.message);
    }
    setIsProcessing(false);
  };

  const clearSelection = () => {
    setFile(null);
    setPreview(null);
    setSaveStatus(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Import Data Mahasiswa</h1>
          <p className="text-surface-200/50 text-sm mt-1">Upload file Excel untuk menambahkan mahasiswa secara massal</p>
        </div>
        
        <button 
          onClick={handleResetData}
          disabled={isProcessing}
          className="btn-secondary border-red-500/30 text-red-400 hover:bg-red-500/10 flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Reset Data
        </button>
      </div>

      {saveStatus && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 ${
          saveStatus.success 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {saveStatus.success ? <CheckCircle2 className="w-5 h-5 mt-0.5" /> : <AlertCircle className="w-5 h-5 mt-0.5" />}
          <div>
            <h3 className="font-semibold text-sm">{saveStatus.success ? 'Berhasil' : 'Gagal'}</h3>
            <p className="text-sm mt-1 opacity-80">{saveStatus.message}</p>
          </div>
        </div>
      )}

      {/* Upload Section */}
      {!preview && (
        <div className="glass-card p-8">
          <div 
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
              isProcessing ? 'border-primary-500/50 bg-primary-500/5' : 'border-surface-200/20 hover:border-primary-500/40 hover:bg-surface-800/50'
            }`}
          >
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
              disabled={isProcessing}
            />
            
            {isProcessing ? (
              <div className="flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 text-primary-400 animate-spin mb-4" />
                <p className="text-surface-100 font-medium">Memproses File Excel...</p>
                <p className="text-surface-200/50 text-sm mt-1">Mohon tunggu sebentar</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="w-16 h-16 rounded-2xl bg-surface-800 flex items-center justify-center mb-4 shadow-inner">
                  <UploadCloud className="w-8 h-8 text-primary-400" />
                </div>
                <h3 className="text-lg font-medium text-surface-100 mb-1">Klik untuk upload file</h3>
                <p className="text-surface-200/50 text-sm mb-6">Mendukung format .xlsx, .xls, .csv, atau .pdf</p>
                
                <div className="bg-surface-800/50 rounded-lg p-4 max-w-sm text-left border border-surface-200/10">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-surface-200/60 mb-2">Format Kolom Wajib</h4>
                  <ul className="text-xs text-surface-200/80 space-y-1.5 list-disc list-inside">
                    <li><span className="font-mono text-primary-300">no_registrasi</span> (String, max 30)</li>
                    <li><span className="font-mono text-primary-300">first_name</span> & <span className="font-mono text-primary-300">last_name</span></li>
                    <li><span className="font-mono text-primary-300">program_study_code</span></li>
                    <li><span className="font-mono text-primary-300">gender</span> (L / P)</li>
                    <li><span className="font-mono text-primary-300">semester</span> (Angka 1-14)</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview Section */}
      {preview && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between glass-card p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center border border-primary-500/20">
                <FileSpreadsheet className="w-6 h-6 text-primary-400" />
              </div>
              <div>
                <h3 className="font-medium text-surface-100">{file?.name}</h3>
                <p className="text-sm text-surface-200/50">
                  Total baris: {preview.total} | Valid: <span className="text-emerald-400 font-medium">{preview.valid.length}</span> | Error: <span className="text-red-400 font-medium">{preview.errors.length}</span>
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button 
                onClick={clearSelection}
                className="btn-secondary flex-1 sm:flex-none flex items-center justify-center gap-2"
                disabled={isSaving}
              >
                <Trash2 className="w-4 h-4" /> Batal
              </button>
              <button 
                onClick={handleSave}
                disabled={preview.valid.length === 0 || isSaving}
                className="btn-primary flex-1 sm:flex-none flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Simpan {preview.valid.length} Data
              </button>
            </div>
          </div>

          {/* Validation Errors */}
          {preview.errors.length > 0 && (
            <div className="glass-card p-5 border-l-4 border-l-red-500">
              <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4" />
                Ditemukan {preview.errors.length} Error Validasi
              </h3>
              <div className="max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-surface-200/60 uppercase sticky top-0 bg-surface-900/90 backdrop-blur-sm">
                    <tr>
                      <th className="py-2 font-medium">Baris</th>
                      <th className="py-2 font-medium">Kolom</th>
                      <th className="py-2 font-medium">Keterangan Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-200/10">
                    {preview.errors.map((error, idx) => (
                      <tr key={idx} className="text-surface-200/80">
                        <td className="py-2 w-16">#{error.row}</td>
                        <td className="py-2 font-mono text-xs text-primary-300">{error.field}</td>
                        <td className="py-2 text-red-300">{error.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-surface-200/40 mt-3 italic">
                *Baris yang error tidak akan dimasukkan ke database. Anda dapat menyimpan data yang valid saja.
              </p>
            </div>
          )}

          {/* Valid Data Preview */}
          {preview.valid.length > 0 && (
            <div className="glass-card overflow-hidden flex flex-col">
              <div className="p-5 border-b border-surface-200/10 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-surface-100">Preview Data Valid</h3>
                <span className="badge border-emerald-500/30 bg-emerald-500/10 text-emerald-400">Siap Disimpan</span>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table min-w-[800px]">
                  <thead>
                    <tr>
                      <th>No. Registrasi</th>
                      <th>Nama Lengkap</th>
                      <th>Kode Prodi</th>
                      <th>Tingkat</th>
                      <th>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.valid.slice(0, 10).map((row, idx) => (
                      <tr key={idx}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-surface-200/70">{row.no_registrasi}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-surface-100">{row.first_name} {row.last_name}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-surface-200/70">{row.program_study_code}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-surface-200/70">Tingkat {Math.ceil((row.semester || 1) / 2)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-surface-200/70">{row.email || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.valid.length > 10 && (
                <div className="p-4 text-center border-t border-surface-200/10 text-xs text-surface-200/50 bg-surface-800/30">
                  Menampilkan 10 dari {preview.valid.length} data valid...
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
