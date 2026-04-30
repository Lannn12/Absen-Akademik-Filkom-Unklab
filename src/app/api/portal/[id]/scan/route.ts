import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

/**
 * POST: Record attendance from the public portal
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { no_registrasi, member_id, pin } = await request.json();
    const supabase = getSupabase();

    // 1. Verify event and PIN
    const { data: event } = await supabase
      .from('bimbingan')
      .select('*')
      .eq('id', id)
      .single();

    if (!event) {
      return NextResponse.json({ success: false, message: 'Event tidak ditemukan' });
    }

    // Check PIN if access_pin column exists and has a value
    if ('access_pin' in event && event.access_pin && pin !== event.access_pin) {
      return NextResponse.json({ success: false, message: 'PIN tidak valid' });
    }

    // 2. Find mahasiswa
    const { data: mhs } = await supabase
      .from('mahasiswa')
      .select('*')
      .eq('no_registrasi', no_registrasi.trim())
      .single();

    if (!mhs) {
      return NextResponse.json({
        success: false,
        message: `Mahasiswa dengan NIM ${no_registrasi} tidak ditemukan`,
      });
    }

    // 3. Validate tingkat
    if (mhs.tingkat !== event.tingkat_target) {
      return NextResponse.json({
        success: false,
        message: `Mahasiswa Tingkat ${mhs.tingkat} tidak sesuai target Tingkat ${event.tingkat_target}`,
      });
    }

    // 4. Check existing attendance
    const { data: existing } = await supabase
      .from('absensi')
      .select('*')
      .eq('mahasiswa_id', mhs.id)
      .eq('bimbingan_id', id)
      .maybeSingle();

    const mhsInfo = {
      first_name: mhs.first_name,
      last_name: mhs.last_name,
      no_registrasi: mhs.no_registrasi,
      tingkat: mhs.tingkat,
    };

    if (!existing) {
      // CHECK IN
      const insertData: any = {
        mahasiswa_id: mhs.id,
        bimbingan_id: id,
      };
      if (member_id) insertData.recorded_by_mhs_id = member_id;

      const { error } = await supabase.from('absensi').insert(insertData);
      if (error) {
        return NextResponse.json({ success: false, message: `DB Error: ${error.message}` });
      }

      return NextResponse.json({
        success: true,
        type: 'check_in',
        message: 'Check-In Berhasil',
        mahasiswa: mhsInfo,
      });
    } else if (!existing.check_out) {
      // CHECK OUT
      const diffMs = Date.now() - new Date(existing.check_in).getTime();
      const diffMinutes = Math.floor(diffMs / 60000);
      const isValid = diffMinutes >= (event.durasi_minimal || 0);

      const { error } = await supabase
        .from('absensi')
        .update({ check_out: new Date().toISOString(), status_valid: isValid })
        .eq('id', existing.id);

      if (error) {
        return NextResponse.json({ success: false, message: `DB Error: ${error.message}` });
      }

      return NextResponse.json({
        success: true,
        type: 'check_out',
        message: `Check-Out (${diffMinutes} min) - ${isValid ? 'VALID' : 'TIDAK VALID'}`,
        mahasiswa: mhsInfo,
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Mahasiswa sudah melakukan Check-Out sebelumnya',
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: `Server: ${err?.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}
