import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST: Record attendance (check-in / check-out) from the public portal.
 * Uses service role to bypass RLS.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { no_registrasi, member_id, pin } = await request.json();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Verify PIN first
  const { data: event } = await supabase
    .from('bimbingan')
    .select('*')
    .eq('id', id)
    .single();

  if (!event) {
    return NextResponse.json({ error: 'Event tidak ditemukan' }, { status: 404 });
  }

  if (event.access_pin && pin !== event.access_pin) {
    return NextResponse.json({ error: 'PIN tidak valid' }, { status: 401 });
  }

  // 2. Find mahasiswa
  const { data: mhs, error: mhsError } = await supabase
    .from('mahasiswa')
    .select('*')
    .eq('no_registrasi', no_registrasi.trim())
    .single();

  if (mhsError || !mhs) {
    return NextResponse.json({
      success: false,
      message: `Mahasiswa dengan No. Reg ${no_registrasi} tidak ditemukan`,
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

  if (!existing) {
    // CHECK IN
    const { error } = await supabase.from('absensi').insert({
      mahasiswa_id: mhs.id,
      bimbingan_id: id,
      recorded_by_mhs_id: member_id || null,
    });

    if (error) {
      return NextResponse.json({ success: false, message: error.message });
    }

    return NextResponse.json({
      success: true,
      type: 'check_in',
      message: 'Check-In Berhasil',
      mahasiswa: { first_name: mhs.first_name, last_name: mhs.last_name, no_registrasi: mhs.no_registrasi, tingkat: mhs.tingkat },
    });
  } else if (!existing.check_out) {
    // CHECK OUT
    const diffMs = Date.now() - new Date(existing.check_in).getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const isValid = diffMinutes >= event.durasi_minimal;

    const { error } = await supabase
      .from('absensi')
      .update({ check_out: new Date().toISOString(), status_valid: isValid })
      .eq('id', existing.id);

    if (error) {
      return NextResponse.json({ success: false, message: error.message });
    }

    return NextResponse.json({
      success: true,
      type: 'check_out',
      message: `Check-Out (${diffMinutes} min) - ${isValid ? 'VALID' : 'TIDAK VALID'}`,
      mahasiswa: { first_name: mhs.first_name, last_name: mhs.last_name, no_registrasi: mhs.no_registrasi, tingkat: mhs.tingkat },
    });
  } else {
    return NextResponse.json({
      success: false,
      message: 'Mahasiswa sudah melakukan Check-Out sebelumnya',
    });
  }
}
