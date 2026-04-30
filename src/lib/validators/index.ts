import { z } from 'zod';

/**
 * Validation schema for Excel import rows.
 */
export const excelRowSchema = z.object({
  no_registrasi: z
    .string()
    .min(1, 'No registrasi wajib diisi')
    .max(30, 'No registrasi maksimal 30 karakter'),
  first_name: z
    .string()
    .min(1, 'Nama depan wajib diisi')
    .max(100, 'Nama depan maksimal 100 karakter'),
  last_name: z
    .string()
    .min(1, 'Nama belakang wajib diisi')
    .max(100, 'Nama belakang maksimal 100 karakter'),
  program_study_code: z
    .string()
    .min(1, 'Kode prodi wajib diisi')
    .max(20, 'Kode prodi maksimal 20 karakter'),
  gender: z.enum(['L', 'P']).optional(),
  semester: z
    .number()
    .int('Semester harus bilangan bulat')
    .min(1, 'Semester minimal 1')
    .max(8, 'Semester maksimal 8'),
  email: z.string().email('Format email tidak valid').optional().or(z.literal('')),
});

/**
 * Validation schema for creating a bimbingan event.
 */
export const bimbinganSchema = z.object({
  nama_kegiatan: z
    .string()
    .min(3, 'Nama kegiatan minimal 3 karakter')
    .max(200, 'Nama kegiatan maksimal 200 karakter'),
  tanggal: z.string().min(1, 'Tanggal wajib diisi'),
  tingkat_target: z
    .number()
    .int()
    .min(1, 'Tingkat minimal 1')
    .max(4, 'Tingkat maksimal 4'),
  waktu_mulai: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format waktu tidak valid (HH:mm)'),
  waktu_selesai: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format waktu tidak valid (HH:mm)'),
  absenter_group_id: z.string().uuid('Absenter group wajib dipilih'),
  access_pin: z.string().min(4, 'PIN minimal 4 karakter').max(6, 'PIN maksimal 6 karakter').optional().or(z.literal('')),
});

/**
 * Validation schema for creating an absenter group.
 */
export const absenterGroupSchema = z.object({
  nama_group: z
    .string()
    .min(2, 'Nama group minimal 2 karakter')
    .max(100, 'Nama group maksimal 100 karakter'),
});

/**
 * Validation schema for mahasiswa form.
 */
export const mahasiswaSchema = z.object({
  no_registrasi: z
    .string()
    .min(1, 'No registrasi wajib diisi')
    .max(30, 'No registrasi maksimal 30 karakter'),
  first_name: z
    .string()
    .min(1, 'Nama depan wajib diisi')
    .max(100, 'Nama depan maksimal 100 karakter'),
  last_name: z
    .string()
    .min(1, 'Nama belakang wajib diisi')
    .max(100, 'Nama belakang maksimal 100 karakter'),
  program_study_code: z
    .string()
    .min(1, 'Kode prodi wajib diisi')
    .max(20, 'Kode prodi maksimal 20 karakter'),
  gender: z.enum(['L', 'P']).optional(),
  semester: z
    .number()
    .int('Semester harus bilangan bulat')
    .min(1, 'Semester minimal 1')
    .max(8, 'Semester maksimal 8'),
  email: z.string().email('Format email tidak valid').optional().or(z.literal('')),
});

export type ExcelRowInput = z.infer<typeof excelRowSchema>;
export type BimbinganInput = z.infer<typeof bimbinganSchema>;
export type AbsenterGroupInput = z.infer<typeof absenterGroupSchema>;
export type MahasiswaInput = z.infer<typeof mahasiswaSchema>;
