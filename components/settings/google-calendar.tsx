type Props = {
  connected: boolean;
  status: string | null;
};

export function GoogleCalendarCard({ connected, status }: Props) {
  let banner: string | null = null;
  if (status === 'connected') banner = 'Google Calendar er koblet til.';
  else if (status === 'state_error') banner = 'Tilkoblingen fikk ikke hengt sammen. Prøv igjen.';
  else if (status === 'missing_tokens') banner = 'Google ga oss ikke det vi trengte. Prøv igjen.';
  else if (status === 'db_error') banner = 'Noe glapp under lagring. Prøv igjen.';

  return (
    <section className="rounded-2xl border bg-card p-6 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Google Calendar</h2>
          <p className="text-sm text-muted-foreground">
            {connected
              ? 'Dagens hendelser hentes hver morgen.'
              : 'Koble på for å få dagsbrief fra kalenderen.'}
          </p>
        </div>
        <a
          href="/api/auth/google"
          className="rounded-full border px-3 py-1 text-sm hover:bg-accent/10"
        >
          {connected ? 'Koble på nytt' : 'Koble til'}
        </a>
      </div>
      {banner ? (
        <p
          className={`text-xs ${
            status === 'connected' ? 'text-primary' : 'text-destructive'
          }`}
        >
          {banner}
        </p>
      ) : null}
    </section>
  );
}
