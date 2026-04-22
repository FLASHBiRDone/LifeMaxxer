import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ household: null, members: [], invites: [] });
  }

  const householdId = (membership as any).household_id as string;

  const [{ data: household }, { data: members }, { data: invites }] = await Promise.all([
    supabase
      .from('households')
      .select('id, name, created_by, created_at')
      .eq('id', householdId)
      .maybeSingle(),
    supabase
      .from('household_members')
      .select('user_id, role, joined_at')
      .eq('household_id', householdId),
    supabase
      .from('household_invites')
      .select('id, code, role, created_at, expires_at, used_at')
      .eq('household_id', householdId)
      .is('used_at', null)
      .order('created_at', { ascending: false }),
  ]);

  const memberList = (members as any[] | null) ?? [];
  let profiles: Array<{ id: string; email: string; display_name: string | null }> = [];
  if (memberList.length > 0) {
    const { data: profs } = await supabase
      .from('user_profiles')
      .select('id, email, display_name')
      .in('id', memberList.map((m) => m.user_id));
    profiles = ((profs as any[]) ?? []).map((p) => ({
      id: p.id,
      email: p.email,
      display_name: p.display_name ?? null,
    }));
  }

  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const enrichedMembers = memberList.map((m) => {
    const profile = profileMap.get(m.user_id);
    return {
      user_id: m.user_id,
      role: m.role,
      joined_at: m.joined_at,
      email: profile?.email ?? null,
      display_name: profile?.display_name ?? null,
      is_me: m.user_id === user.id,
    };
  });

  const now = Date.now();
  const activeInvites = ((invites as any[]) ?? []).filter(
    (i) => new Date(i.expires_at).getTime() > now,
  );

  return NextResponse.json({
    household,
    role: (membership as any).role,
    members: enrichedMembers,
    invites: activeInvites,
  });
}
