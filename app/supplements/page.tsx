import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SupplementsClient, type Supplement } from '@/components/supplements/supplements-client';

export const dynamic = 'force-dynamic';

export default async function SupplementsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase
    .from('supplements')
    .select('*')
    .eq('user_id', user.id)
    .eq('archived', false)
    .order('created_at', { ascending: true });

  return (
    <main className="container max-w-xl py-6">
      <SupplementsClient initial={(data as Supplement[]) ?? []} />
    </main>
  );
}
