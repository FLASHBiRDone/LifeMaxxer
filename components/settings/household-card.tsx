'use client';

import { useState } from 'react';
import { Check, Copy, Loader2, LogIn, Trash2, UserPlus, Users } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Member = {
  user_id: string;
  role: string;
  joined_at: string;
  email: string | null;
  display_name: string | null;
  is_me: boolean;
};

type Invite = {
  id: string;
  code: string;
  role: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
};

type Household = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
} | null;

const ROLE_LABEL: Record<string, string> = {
  primary: 'Eier',
  partner: 'Partner',
  child: 'Barn',
};

function initialFor(m: Member): string {
  const source = m.display_name ?? m.email ?? '?';
  return source.charAt(0).toUpperCase();
}

function labelFor(m: Member): string {
  return m.display_name ?? m.email ?? 'Medlem';
}

export function HouseholdCard({
  household,
  role,
  members,
  invites: initialInvites,
  currentDisplayName,
}: {
  household: Household;
  role: string | null;
  members: Member[];
  invites: Invite[];
  currentDisplayName: string | null;
}) {
  const [invites, setInvites] = useState<Invite[]>(initialInvites);
  const [displayName, setDisplayName] = useState(currentDisplayName ?? '');
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [creating, setCreating] = useState(false);
  const [inviteRole, setInviteRole] = useState<'partner' | 'child'>('partner');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinOk, setJoinOk] = useState(false);

  async function saveName() {
    setSavingName(true);
    setNameSaved(false);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName.trim() ? displayName.trim() : null,
        }),
      });
      if (res.ok) {
        setNameSaved(true);
        setTimeout(() => setNameSaved(false), 1500);
      }
    } finally {
      setSavingName(false);
    }
  }

  async function createInvite() {
    setCreating(true);
    try {
      const res = await fetch('/api/household/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: inviteRole }),
      });
      if (res.ok) {
        const { invite } = (await res.json()) as { invite: Invite };
        setInvites((prev) => [invite, ...prev]);
      }
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    setInvites((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/household/invites/${id}`, { method: 'DELETE' });
  }

  async function copy(invite: Invite) {
    try {
      await navigator.clipboard.writeText(invite.code);
      setCopiedId(invite.id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {
      // ignore
    }
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setJoining(true);
    setJoinError(null);
    setJoinOk(false);
    try {
      const res = await fetch('/api/household/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body.error ?? 'ukjent feil';
        const friendly =
          msg.includes('invalid code')
            ? 'Ugyldig kode.'
            : msg.includes('already used')
              ? 'Koden er allerede brukt.'
              : msg.includes('expired')
                ? 'Koden er utløpt.'
                : 'Kunne ikke bli med.';
        setJoinError(friendly);
        return;
      }
      setJoinOk(true);
      setJoinCode('');
      setTimeout(() => {
        window.location.reload();
      }, 600);
    } finally {
      setJoining(false);
    }
  }

  const hasHousehold = Boolean(household);
  const canManage = role === 'primary' || role === 'partner';
  const showJoin = !hasHousehold;

  return (
    <section className="rounded-2xl border bg-card p-5 soft-shadow space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <Users className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold truncate">
            {household?.name ?? 'Husholdning'}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {members.length} medlem{members.length === 1 ? '' : 'mer'}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Ditt visningsnavn
        </p>
        <div className="flex gap-2">
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value.slice(0, 40))}
            placeholder="Mamma, Emma, …"
            maxLength={40}
          />
          <Button
            type="button"
            variant="outline"
            onClick={saveName}
            disabled={savingName}
          >
            {savingName ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : nameSaved ? (
              <Check className="h-4 w-4" />
            ) : (
              'Lagre'
            )}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Brukes på delte oppdrag for å vise hvem som krysset av.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Medlemmer
        </p>
        <ul className="divide-y divide-border/40 rounded-xl border overflow-hidden">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="h-8 w-8 rounded-full grad-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                {initialFor(m)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {labelFor(m)}
                  {m.is_me && (
                    <span className="ml-2 text-[10px] text-muted-foreground">(deg)</span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {ROLE_LABEL[m.role] ?? m.role}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {canManage && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Inviter noen
          </p>
          <div className="flex gap-2">
            <div className="flex rounded-xl border bg-muted/40 p-0.5 text-xs font-medium">
              {(['partner', 'child'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setInviteRole(r)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg transition-colors',
                    inviteRole === r
                      ? 'bg-card shadow-sm text-foreground'
                      : 'text-muted-foreground',
                  )}
                >
                  {r === 'partner' ? 'Partner' : 'Barn'}
                </button>
              ))}
            </div>
            <Button
              type="button"
              onClick={createInvite}
              disabled={creating}
              className="flex-1 grad-primary text-primary-foreground border-transparent"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-1.5" /> Lag kode
                </>
              )}
            </Button>
          </div>

          {invites.length > 0 && (
            <ul className="space-y-1.5">
              {invites.map((i) => {
                const expires = new Date(i.expires_at);
                return (
                  <li
                    key={i.id}
                    className="flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2"
                  >
                    <span className="font-mono text-sm tracking-widest flex-1">
                      {i.code}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {ROLE_LABEL[i.role] ?? i.role} ·{' '}
                      {expires.toLocaleDateString('nb-NO', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => copy(i)}
                      className="text-muted-foreground hover:text-primary"
                      aria-label="Kopier"
                    >
                      {copiedId === i.id ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => revoke(i.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Trekk tilbake"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="text-[11px] text-muted-foreground">
            Del koden. Den gjelder i 7 dager og kan brukes én gang.
          </p>
        </div>
      )}

      {showJoin && (
        <div className="space-y-2 pt-2 border-t border-border/50">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Bli med i et hushold
          </p>
          <form onSubmit={join} className="flex gap-2">
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="8-tegns kode"
              maxLength={16}
              className="font-mono tracking-widest"
            />
            <Button
              type="submit"
              variant="outline"
              disabled={joining || joinCode.trim().length < 4}
            >
              {joining ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-1.5" /> Bli med
                </>
              )}
            </Button>
          </form>
          {joinError && <p className="text-[11px] text-destructive">{joinError}</p>}
          {joinOk && (
            <p className="text-[11px] text-primary">Lagt til. Laster inn…</p>
          )}
        </div>
      )}
    </section>
  );
}
