import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ShoppingClient } from '@/components/shopping/shopping-client';
import { findPendingShoppingEvent } from '@/lib/shopping-event';

export const dynamic = 'force-dynamic';

export default async function ShoppingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: memberships } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id);

  const householdIds = ((memberships as { household_id: string }[] | null) ?? []).map(
    (m) => m.household_id,
  );

  let items: any[] = [];
  if (householdIds.length > 0) {
    const { data } = await supabase
      .from('shopping_list_items')
      .select('id, freeform_text, checked, created_at')
      .in('household_id', householdIds)
      .order('created_at', { ascending: true });
    items = data ?? [];
  }

  const [pendingEvent, { data: gtok }] = await Promise.all([
    findPendingShoppingEvent(supabase, user.id),
    supabase
      .from('google_tokens')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  const initialPendingEvent = pendingEvent
    ? { id: pendingEvent.id, start_at: pendingEvent.start_at, end_at: pendingEvent.end_at }
    : null;

  return (
    <main className="container max-w-xl py-6">
      <ShoppingClient
        initialItems={items}
        initialPendingEvent={initialPendingEvent}
        googleConnected={Boolean(gtok)}
      />
    </main>
  );
}
