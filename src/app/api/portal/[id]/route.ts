import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  return createClient(url, key);
}

/**
 * GET: Fetch event data for the portal (bypasses RLS)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    // Fetch the event - only select columns that definitely exist
    const { data: event, error } = await supabase
      .from('bimbingan')
      .select('id, nama_kegiatan, tanggal, tingkat_target, durasi_minimal, status, absenter_group_id, absenter_group(id, nama_group)')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
    }

    if (!event) {
      return NextResponse.json({ error: 'Event tidak ditemukan' }, { status: 404 });
    }

    // Try to get access_pin separately (column may not exist yet)
    let accessPin = null;
    try {
      const { data: pinData } = await supabase
        .from('bimbingan')
        .select('access_pin')
        .eq('id', id)
        .single();
      if (pinData) accessPin = pinData.access_pin;
    } catch {
      // access_pin column doesn't exist yet, that's okay
    }

    // Fetch group members
    let members: any[] = [];
    if (event.absenter_group_id) {
      const { data, error: memberError } = await supabase
        .from('absenter_members')
        .select('mahasiswa_id, mahasiswa(id, first_name, last_name, no_registrasi)')
        .eq('group_id', event.absenter_group_id);
      
      if (!memberError && data) members = data;
    }

    return NextResponse.json({
      event: {
        ...event,
        has_pin: !!accessPin,
        access_pin: undefined,
      },
      members,
    });
  } catch (err: any) {
    console.error('Portal API error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
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
    const { pin } = await request.json();
    const supabase = getSupabase();

    // Try to get access_pin
    let accessPin = null;
    try {
      const { data } = await supabase
        .from('bimbingan')
        .select('access_pin')
        .eq('id', id)
        .single();
      if (data) accessPin = data.access_pin;
    } catch {
      // Column doesn't exist, treat as no PIN needed
    }

    // If no PIN is set, auto-authorize
    if (!accessPin) {
      return NextResponse.json({ authorized: true });
    }

    if (pin === accessPin) {
      return NextResponse.json({ authorized: true });
    }

    return NextResponse.json({ authorized: false, error: 'PIN salah' }, { status: 401 });
  } catch (err: any) {
    console.error('PIN verify error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
