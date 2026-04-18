import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const parse = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parse.success) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const { endpoint, keys } = parse.data;

  await supabase.from('push_subscriptions').upsert(
    { user_id: user.id, endpoint, keys },
    { onConflict: 'endpoint' },
  );
  await supabase
    .from('user_settings')
    .update({ push_enabled: true, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : null;
  if (endpoint) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint);
  }
  // If no subscriptions remain, turn the opt-in flag off.
  const { data: remaining } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .limit(1);
  if (!remaining || remaining.length === 0) {
    await supabase
      .from('user_settings')
      .update({ push_enabled: false, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
  }
  return NextResponse.json({ ok: true });
}
