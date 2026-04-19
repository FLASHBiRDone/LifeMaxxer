import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sortInboxItems } from '@/lib/inbox-sort';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: items } = await supabase
    .from('brain_dump')
    .select('id, content')
    .eq('user_id', user.id)
    .eq('processed', false)
    .order('created_at', { ascending: true })
    .limit(30);

  const list = (items as { id: string; content: string }[] | null) ?? [];
  if (list.length === 0) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const result = await sortInboxItems(list);
    await supabase.from('ai_messages').insert({
      user_id: user.id,
      role: 'assistant',
      content: JSON.stringify(result.suggestions),
      context_type: 'inbox_sort',
      prompt_version: result.promptVersion,
      tokens_in: result.tokensIn,
      tokens_out: result.tokensOut,
      cost_usd: result.costUsd,
    });
    return NextResponse.json({ suggestions: result.suggestions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
