import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { osloDayBounds } from '@/lib/time';
import { HabitList } from '@/components/habits/habit-list';

export const dynamic = 'force-dynamic';

export default async function HabitsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { dateString } = osloDayBounds();

  const [{ data: habits }, { data: logs }] = await Promise.all([
    supabase
      .from('habits')
      .select('*')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: true }),
    supabase
      .from('habit_logs')
      .select('habit_id')
      .eq('user_id', user.id)
      .eq('logged_for', dateString),
  ]);

  const loggedIds = (logs ?? []).map((l: { habit_id: string }) => l.habit_id);

  return (
    <main className="container max-w-xl py-6">
      <HabitList
        habits={(habits as any[]) ?? []}
        loggedToday={loggedIds}
      />
    </main>
  );
}
