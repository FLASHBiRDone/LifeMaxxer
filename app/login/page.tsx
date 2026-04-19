'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Sparkles, Mail, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('sending');
    setMessage(null);
    const supabase = createClient();
    const redirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;
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
    <main className="min-h-dvh grid place-items-center p-6 grad-hero">
      <div className="w-full max-w-sm space-y-8">
        <header className="space-y-4 text-center">
          <div className="mx-auto h-16 w-16 rounded-3xl grad-primary flex items-center justify-center text-primary-foreground soft-shadow">
            <Sparkles className="h-8 w-8" strokeWidth={2.5} />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-3xl font-bold">
              <span className="text-grad">{t('app.name')}</span>
            </h1>
            <p className="text-sm text-muted-foreground">{t('app.tagline')}</p>
          </div>
        </header>

        {status === 'sent' ? (
          <div className="rounded-3xl border bg-card p-8 text-center space-y-3 soft-shadow">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-success/15 text-success flex items-center justify-center">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">Sjekk innboksen</p>
              <p className="text-sm text-muted-foreground mt-1">{email}</p>
            </div>
            <p className="text-xs text-muted-foreground pt-2">
              Vi har sendt deg en magisk lenke. Trykk på den for å logge inn.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="rounded-3xl border bg-card p-6 space-y-4 soft-shadow">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="email">E-post</label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="deg@eksempel.no"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 text-base"
              />
            </div>
            <Button
              type="submit"
              disabled={status === 'sending'}
              className="w-full grad-primary border-transparent h-12 text-base"
            >
              {status === 'sending' ? 'Sender…' : (
                <>Send magisk lenke <ArrowRight className="h-4 w-4" /></>
              )}
            </Button>
            {message && <p className="text-sm text-destructive">{message}</p>}
          </form>
        )}

        <p className="text-[11px] text-center text-muted-foreground">
          Ingen passord. Ingen overvåking. Bare stillhet når du trenger det.
        </p>
      </div>
    </main>
  );
}
