import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { InboxClient } from '@/components/inbox/inbox-client';

export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: items } = await supabase
    .from('brain_dump')
    .select('id, content, created_at')
    .eq('user_id', user.id)
    .eq('processed', false)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <main className="container max-w-xl py-6">
      <InboxClient initialItems={(items as any[]) ?? []} />
    </main>
  );
}
