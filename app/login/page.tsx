'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  );
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('sending');
    setMessage(null);
    const supabase = createClient();
    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback`
        : undefined;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) {
      setStatus('error');
      setMessage(error.message);
    } else {
      setStatus('sent');
      setMessage(null);
    }
    router.refresh();
  }

  return (
    <main className="container max-w-sm py-16 space-y-6">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('app.name')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('app.tagline')}</p>
      </header>

      {status === 'sent' ? (
        <div className="rounded-2xl border bg-card p-6 text-sm space-y-2">
          <p>Check your inbox for a link.</p>
          <p className="text-muted-foreground">{email}</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border bg-background px-4 py-3 text-base outline-none ring-0 focus:border-ring"
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            className="w-full rounded-xl bg-primary px-4 py-3 text-base font-medium text-primary-foreground disabled:opacity-60"
          >
            {status === 'sending' ? '…' : 'Send magic link'}
          </button>
          {message ? (
            <p className="text-sm text-destructive">{message}</p>
          ) : null}
        </form>
      )}
    </main>
  );
}
