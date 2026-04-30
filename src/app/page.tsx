import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Force dynamic rendering — this page uses cookies for auth
export const dynamic = 'force-dynamic';

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
