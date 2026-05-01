/**
 * Application-wide constants
 */

export const APP_NAME = 'Sistemnya Arlan';
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

export const SIDEBAR_MENU = {
  admin: [
    { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    { href: '/mahasiswa', label: 'Data Mahasiswa', icon: 'GraduationCap' },
    { href: '/mahasiswa/import', label: 'Import Excel', icon: 'FileSpreadsheet' },
    { href: '/bimbingan', label: 'Event Bimbingan', icon: 'Calendar' },
    { href: '/absenter', label: 'Absenter Group', icon: 'Users' },
    { href: '/kepatuhan', label: 'Kehadiran', icon: 'ClipboardCheck' },
    { href: '/users', label: 'Manajemen User', icon: 'UserCog' },
  ],
  absenter: [
    { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    { href: '/bimbingan', label: 'Event Bimbingan', icon: 'Calendar' },
  ],
  mahasiswa: [
    { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    { href: '/kepatuhan', label: 'Kehadiran Saya', icon: 'ClipboardCheck' },
  ],
} as const;
