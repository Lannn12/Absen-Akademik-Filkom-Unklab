/**
 * Application-wide constants
 */

export const APP_NAME = 'Smart Academic Guidance';
export const APP_DESCRIPTION = 'Sistem Absensi Bimbingan Akademik per Tingkat';

export const TINGKAT_OPTIONS = [1, 2, 3, 4] as const;

export const GENDER_OPTIONS = [
  { value: 'L', label: 'Laki-laki' },
  { value: 'P', label: 'Perempuan' },
] as const;

export const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin (BEM)' },
  { value: 'absenter', label: 'Absenter (Petugas)' },
  { value: 'mahasiswa', label: 'Mahasiswa' },
] as const;

export const EVENT_STATUS_OPTIONS = [
  { value: 'active', label: 'Aktif' },
  { value: 'closed', label: 'Selesai' },
] as const;

export const COMPLIANCE_THRESHOLDS = {
  PATUH: 80,
  PERLU_PERHATIAN: 50,
} as const;

export const SIDEBAR_MENU = {
  admin: [
    { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    { href: '/mahasiswa', label: 'Data Mahasiswa', icon: 'GraduationCap' },
    { href: '/mahasiswa/import', label: 'Import Excel', icon: 'FileSpreadsheet' },
    { href: '/bimbingan', label: 'Event Bimbingan', icon: 'Calendar' },
    { href: '/absenter', label: 'Absenter Group', icon: 'Users' },
    { href: '/scan', label: 'Scan Absensi', icon: 'ScanLine' },
    { href: '/kepatuhan', label: 'Kepatuhan', icon: 'ShieldCheck' },
    { href: '/absenter/kinerja', label: 'Kinerja Absenter', icon: 'BarChart3' },
  ],
  absenter: [
    { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    { href: '/scan', label: 'Scan Absensi', icon: 'ScanLine' },
    { href: '/bimbingan', label: 'Event Bimbingan', icon: 'Calendar' },
  ],
  mahasiswa: [
    { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    { href: '/kepatuhan', label: 'Kehadiran Saya', icon: 'ShieldCheck' },
  ],
} as const;
