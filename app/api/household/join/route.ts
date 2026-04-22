import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const bodySchema = z.object({
  code: z.string().trim().min(4).max(32),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const code = parsed.data.code.toUpperCase();

  const { data, error } = await supabase.rpc('accept_household_invite', {
    invite_code: code,
  });

  if (error) {
    const msg = error.message || 'kunne ikke bli med';
    let status = 400;
    if (msg.includes('invalid code')) status = 404;
    else if (msg.includes('expired') || msg.includes('already used')) status = 410;
    return NextResponse.json({ error: msg }, { status });
  }

  return NextResponse.json({ ok: true, householdId: data });
}
