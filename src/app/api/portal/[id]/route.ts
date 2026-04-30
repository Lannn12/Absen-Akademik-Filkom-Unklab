import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  // Use service role key if available, otherwise fall back to anon key
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

/**
 * GET: Fetch event data for the portal
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    // Fetch the event
    const { data: event, error } = await supabase
      .from('bimbingan')
      .select('id, nama_kegiatan, tanggal, tingkat_target, durasi_minimal, status, absenter_group_id, absenter_group(id, nama_group)')
      .eq('id', id)
      .single();

    if (error || !event) {
      return NextResponse.json(
        { error: error?.message || 'Event tidak ditemukan' },
        { status: 404 }
      );
    }

    // Try to get access_pin (column may not exist yet)
    let accessPin: string | null = null;
    const { data: pinData } = await supabase
      .from('bimbingan')
      .select('access_pin')
      .eq('id', id)
      .single();
    if (pinData && 'access_pin' in pinData) {
      accessPin = (pinData as any).access_pin;
    }

    // Fetch group members
    let members: any[] = [];
    if (event.absenter_group_id) {
      const { data } = await supabase
        .from('absenter_members')
        .select('mahasiswa_id, mahasiswa(id, first_name, last_name, no_registrasi)')
        .eq('group_id', event.absenter_group_id);
      if (data) members = data;
    }

    return NextResponse.json({
      event: {
        id: event.id,
        nama_kegiatan: event.nama_kegiatan,
        tanggal: event.tanggal,
        tingkat_target: event.tingkat_target,
        durasi_minimal: event.durasi_minimal,
        status: event.status,
        absenter_group_id: event.absenter_group_id,
        has_pin: !!accessPin,
      },
      members,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Server: ${err?.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}

/**
 * POST: Verify PIN for portal access
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const pin = body.pin || '';
    const supabase = getSupabase();

    const { data } = await supabase
      .from('bimbingan')
      .select('access_pin')
      .eq('id', id)
      .single();

    const storedPin = data && 'access_pin' in data ? (data as any).access_pin : null;

    // If no PIN is set, auto-authorize
    if (!storedPin) {
      return NextResponse.json({ authorized: true });
    }

    if (pin === storedPin) {
      return NextResponse.json({ authorized: true });
    }

    return NextResponse.json({ authorized: false, error: 'PIN salah' }, { status: 401 });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Server: ${err?.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}
