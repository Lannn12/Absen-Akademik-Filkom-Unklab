import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Public API route for the Scanner Portal.
 * Uses the service role key to bypass RLS, allowing unauthenticated
 * absenter members to fetch event data via PIN verification.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Use service role to bypass RLS for portal access
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch the event
  const { data: event, error } = await supabase
    .from('bimbingan')
    .select('id, nama_kegiatan, tanggal, tingkat_target, durasi_minimal, status, access_pin, absenter_group_id, absenter_group(id, nama_group)')
    .eq('id', id)
    .single();

  if (error || !event) {
    return NextResponse.json({ error: 'Event tidak ditemukan' }, { status: 404 });
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

  // Don't expose the actual PIN in the response - just whether it exists
  return NextResponse.json({
    event: {
      ...event,
      has_pin: !!event.access_pin,
      access_pin: undefined, // Never send PIN to client
    },
    members,
  });
}

/**
 * POST: Verify PIN for portal access
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { pin } = await request.json();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: event } = await supabase
    .from('bimbingan')
    .select('access_pin')
    .eq('id', id)
    .single();

  if (!event) {
    return NextResponse.json({ error: 'Event tidak ditemukan' }, { status: 404 });
  }

  if (event.access_pin && pin === event.access_pin) {
    return NextResponse.json({ authorized: true });
  }

  return NextResponse.json({ authorized: false, error: 'PIN salah' }, { status: 401 });
}
