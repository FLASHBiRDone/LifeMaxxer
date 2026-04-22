import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateHouseholdId } from '@/lib/household';

export const runtime = 'nodejs';

const bodySchema = z.object({
  role: z.enum(['partner', 'child']).default('partner'),
});

// Unambiguous alphabet (no 0/O, 1/I/L)
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateCode(length = 8): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
  }
  return out;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  let householdId: string;
  try {
    householdId = await getOrCreateHouseholdId(supabase, user.id);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'household error' },
      { status: 500 },
    );
  }

  // Retry a few times if a unique collision happens
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode(8);
    const { data, error } = await supabase
      .from('household_invites')
      .insert({
        household_id: householdId,
        code,
        role: parsed.data.role,
        created_by: user.id,
      })
      .select('id, code, role, created_at, expires_at, used_at')
      .single();
    if (!error && data) {
      return NextResponse.json({ invite: data });
    }
    lastError = error?.message ?? 'unknown error';
    // Retry only on unique violation
    if (!error?.message?.includes('duplicate')) break;
  }

  return NextResponse.json({ error: lastError ?? 'kunne ikke opprette' }, { status: 500 });
}
