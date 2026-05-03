'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Sparkles, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [googlePending, setGooglePending] = useState(false);

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

  async function signInWithGoogle() {
    setGooglePending(true);
    setMessage(null);
    const supabase = createClient();
    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback`
        : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        // 'select_account' forces the chooser instead of silently
        // logging into the most-recent Google account on this device.
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) {
      setGooglePending(false);
      setMessage(error.message);
    }
    // On success the browser navigates to Google — no further state to set.
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
          <div className="rounded-3xl border bg-card p-6 space-y-4 soft-shadow">
            <div className="text-center space-y-1">
              <h2 className="text-base font-semibold">Logg inn eller opprett konto</h2>
              <p className="text-[11px] text-muted-foreground">
                Bruk samme metode som forrige gang for å åpne din konto.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={signInWithGoogle}
              disabled={googlePending}
              className="w-full h-12 text-base bg-card"
            >
              {googlePending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <GoogleMark className="h-4 w-4 mr-2" />
                  Fortsett med Google
                </>
              )}
            </Button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
                eller
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
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
                {status === 'sending' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Send magisk lenke <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
              {message && <p className="text-sm text-destructive">{message}</p>}
            </form>
          </div>
        )}

        <p className="text-[11px] text-center text-muted-foreground">
          Ingen passord. Ingen overvåking. Bare stillhet når du trenger det.
        </p>
      </div>
    </main>
  );
}

/** Google "G" brand mark — inline so we don't need an extra asset. */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}
