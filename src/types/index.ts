// ============================================================================
// Database Types - Auto-generated from Supabase schema
// ============================================================================

export type Role = 'admin' | 'absenter' | 'mahasiswa';
export type Gender = 'L' | 'P';
export type EventStatus = 'active' | 'closed';
export type ComplianceStatus = 'patuh' | 'perlu_perhatian' | 'tidak_patuh';

// ============================================================================
// Database Row Types
// ============================================================================

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  created_at: string;
}

export interface Mahasiswa {
  id: string;
  no_registrasi: string;
  first_name: string;
  last_name: string;
  program_study_code: string;
  gender: Gender;
  semester: number;
  email?: string;
  tingkat: number;
  created_at: string;
}

export interface AbsenterGroup {
  id: string;
  nama_group: string;
  created_at: string;
}

export interface AbsenterMember {
  id: string;
  user_id: string;
  group_id: string;
  created_at: string;
  // Joined fields
  profile?: Profile;
  group?: AbsenterGroup;
}

export interface Bimbingan {
  id: string;
  nama_kegiatan: string;
  tanggal: string;
  waktu_mulai: string;
  waktu_selesai: string;
  tingkat_target: number;
  absenter_group_id: string;
  status: EventStatus;
  access_pin?: string;
  created_at: string;
  // Joined fields
  absenter_group?: AbsenterGroup;
  absensi_count?: number;
}

export interface Absensi {
  id: string;
  mahasiswa_id: string;
  bimbingan_id: string;
  check_in: string;
  check_out: string | null;
  status_valid: boolean | null;
  recorded_by: string;
  created_at: string;
  // Joined fields
  mahasiswa?: Mahasiswa;
  bimbingan?: Bimbingan;
  recorder?: Profile;
}

// ============================================================================
// Excel Import Types
// ============================================================================

export interface ExcelRow {
  first_name: string;
  last_name: string;
  program_study_code: string;
  gender: string;
  semester: number;
  no_registrasi: string;
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
}

export interface ImportPreview {
  valid: ExcelRow[];
  errors: ImportError[];
  total: number;
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface ComplianceData {
  mahasiswa_id: string;
  mahasiswa: Mahasiswa;
  total_wajib: number;
  total_hadir: number;
  total_valid: number;
  persentase: number;
  status: ComplianceStatus;
}

export interface TingkatStats {
  tingkat: number;
  total_mahasiswa: number;
  total_hadir: number;
  rata_rata_kehadiran: number;
}

export interface AbsenterPerformance {
  user_id: string;
  profile: Profile;
  total_scans: number;
  total_events: number;
}

export interface EarlyWarning {
  mahasiswa: Mahasiswa;
  events_missed: number;
  events_remaining: number;
  current_percentage: number;
  max_possible: number;
  risk_level: 'high' | 'medium' | 'low';
}

export interface DashboardData {
  total_mahasiswa: number;
  total_events: number;
  total_absensi: number;
  avg_kehadiran: number;
  kehadiran_per_tingkat: TingkatStats[];
  distribusi_kepatuhan: {
    patuh: number;
    perlu_perhatian: number;
    tidak_patuh: number;
  };
  mahasiswa_teraktif: ComplianceData[];
  mahasiswa_tidak_aktif: ComplianceData[];
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ============================================================================
// Scan Types
// ============================================================================

export interface ScanResult {
  success: boolean;
  type: 'check_in' | 'check_out';
  mahasiswa?: Mahasiswa;
  message: string;
  timestamp: string;
}
