import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const bodySchema = z.object({
  note: z.string().trim().max(200).optional(),
});

/**
 * Mark a voucher as used. Trust-based: the user is telling us they've
 * consumed the reward in real life. Redemption is non-reversible.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const { data: voucher } = await supabase
    .from('reward_vouchers')
    .select('id, user_id, redeemed_at')
    .eq('id', id)
    .maybeSingle();
  if (!voucher) return NextResponse.json({ error: 'Ikke funnet' }, { status: 404 });
  if ((voucher as any).user_id !== user.id) {
    return NextResponse.json({ error: 'Ikke ditt' }, { status: 403 });
  }
  if ((voucher as any).redeemed_at) {
    return NextResponse.json({ error: 'Allerede brukt' }, { status: 400 });
  }

  const { error } = await supabase
    .from('reward_vouchers')
    .update({
      redeemed_at: new Date().toISOString(),
      redeemed_note: parsed.data.note ?? null,
    })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
