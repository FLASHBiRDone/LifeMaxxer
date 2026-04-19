import { Calendar, Check } from 'lucide-react';
import { cn } from '@/lib/cn';

type Props = {
  connected: boolean;
  status: string | null;
};

export function GoogleCalendarCard({ connected, status }: Props) {
  let banner: string | null = null;
  let bannerOk = false;
  if (status === 'connected') { banner = 'Google Calendar er koblet til.'; bannerOk = true; }
  else if (status === 'state_error') banner = 'Tilkoblingen fikk ikke hengt sammen. Prøv igjen.';
  else if (status === 'missing_tokens') banner = 'Google ga oss ikke det vi trengte. Prøv igjen.';
  else if (status === 'db_error') banner = 'Noe glapp under lagring. Prøv igjen.';

  return (
    <section className="rounded-2xl border bg-card p-5 space-y-3 soft-shadow">
      <div className="flex items-start gap-4">
        <div className={cn(
          'h-11 w-11 rounded-2xl flex items-center justify-center flex-shrink-0',
          connected ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground',
        )}>
          {connected ? <Check className="h-5 w-5" strokeWidth={3} /> : <Calendar className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Google Calendar</h2>
            <a
              href="/api/auth/google"
              className="text-xs font-medium rounded-full border px-3 py-1.5 hover:bg-accent/10 transition-colors whitespace-nowrap"
            >
              {connected ? 'Koble på nytt' : 'Koble til'}
            </a>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {connected
              ? 'Dagens hendelser hentes hver morgen. Du kan skrive vaner inn i kalenderen.'
              : 'Koble på for dagsbrief og for å skrive vaner inn i kalenderen.'}
          </p>
        </div>
      </div>
      {banner && (
        <p className={cn('text-xs', bannerOk ? 'text-success' : 'text-destructive')}>
          {banner}
        </p>
      )}
    </section>
  );
}
