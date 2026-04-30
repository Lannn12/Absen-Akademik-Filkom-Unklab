-- ============================================================================
-- Smart Academic Guidance Attendance System
-- Database Schema for Supabase
-- ============================================================================
-- INSTRUKSI: Jalankan SQL ini di Supabase SQL Editor
-- (https://supabase.com/dashboard → SQL Editor → New Query)
-- ============================================================================

-- 1. Profiles (linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR NOT NULL,
    full_name VARCHAR NOT NULL,
    role VARCHAR NOT NULL CHECK (role IN ('admin', 'absenter', 'mahasiswa')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Mahasiswa
CREATE TABLE IF NOT EXISTS mahasiswa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    no_registrasi VARCHAR UNIQUE NOT NULL,
    first_name VARCHAR NOT NULL,
    last_name VARCHAR NOT NULL,
    program_study_code VARCHAR NOT NULL,
    gender VARCHAR NOT NULL CHECK (gender IN ('L', 'P')),
    semester INT NOT NULL CHECK (semester BETWEEN 1 AND 14),
    email VARCHAR UNIQUE,
    tingkat INT GENERATED ALWAYS AS (CEIL(semester::NUMERIC / 2)) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Absenter Group
CREATE TABLE IF NOT EXISTS absenter_group (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_group VARCHAR NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Absenter Members
CREATE TABLE IF NOT EXISTS absenter_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES absenter_group(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, group_id)
);

-- 5. Bimbingan (Events)
CREATE TABLE IF NOT EXISTS bimbingan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_kegiatan VARCHAR NOT NULL,
    tanggal DATE NOT NULL,
    tingkat_target INT NOT NULL CHECK (tingkat_target BETWEEN 1 AND 7),
    durasi_minimal INT NOT NULL DEFAULT 30,
    absenter_group_id UUID NOT NULL REFERENCES absenter_group(id),
    status VARCHAR NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Absensi (Attendance Records)
CREATE TABLE IF NOT EXISTS absensi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mahasiswa_id UUID NOT NULL REFERENCES mahasiswa(id) ON DELETE CASCADE,
    bimbingan_id UUID NOT NULL REFERENCES bimbingan(id) ON DELETE CASCADE,
    check_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    check_out TIMESTAMPTZ,
    status_valid BOOLEAN,
    recorded_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(mahasiswa_id, bimbingan_id)
);

-- ============================================================================
-- Trigger: Auto-create profile on signup
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'absenter')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mahasiswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE absenter_group ENABLE ROW LEVEL SECURITY;
ALTER TABLE absenter_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE bimbingan ENABLE ROW LEVEL SECURITY;
ALTER TABLE absensi ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admin full access profiles" ON profiles FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Mahasiswa
CREATE POLICY "Authenticated read mahasiswa" ON mahasiswa FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin manage mahasiswa" ON mahasiswa FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Absenter Group
CREATE POLICY "Authenticated read groups" ON absenter_group FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin manage groups" ON absenter_group FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Absenter Members
CREATE POLICY "Authenticated read members" ON absenter_members FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin manage members" ON absenter_members FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Bimbingan
CREATE POLICY "Authenticated read bimbingan" ON bimbingan FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin manage bimbingan" ON bimbingan FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Absensi
CREATE POLICY "Authenticated read absensi" ON absensi FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Staff insert absensi" ON absensi FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'absenter'))
);
CREATE POLICY "Staff update absensi" ON absensi FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'absenter'))
);

-- ============================================================================
-- Performance Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_mahasiswa_no_reg ON mahasiswa(no_registrasi);
CREATE INDEX IF NOT EXISTS idx_mahasiswa_tingkat ON mahasiswa(tingkat);
CREATE INDEX IF NOT EXISTS idx_absensi_mahasiswa ON absensi(mahasiswa_id);
CREATE INDEX IF NOT EXISTS idx_absensi_bimbingan ON absensi(bimbingan_id);
CREATE INDEX IF NOT EXISTS idx_bimbingan_tingkat ON bimbingan(tingkat_target);
CREATE INDEX IF NOT EXISTS idx_bimbingan_tanggal ON bimbingan(tanggal);
CREATE INDEX IF NOT EXISTS idx_absenter_members_user ON absenter_members(user_id);
CREATE INDEX IF NOT EXISTS idx_absenter_members_group ON absenter_members(group_id);
