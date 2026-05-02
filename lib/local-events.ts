import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getClaude, MODELS, estimateCostUsd } from '@/lib/claude';
import type { Locale } from '@/lib/prompts/locales';

/**
 * Local-disruption finder. Uses Claude's server-side web_search tool
 * to look up events that might break a resident's normal routine in
 * a given city (transit closures, road closures, public events,
 * emergency-broadcast tests, severe weather warnings, mass flight
 * cancellations, utility outages). Filters strictly — silence is
 * better than noise.
 *
 * Output is structured JSON the morning brief job stores in
 * ai_messages.context_type='local_disruptions' so /today's card and
 * the brief itself can both read from one source of truth without
 * re-searching.
 */

export type DisruptionType =
  | 'transit'
  | 'road'
  | 'event'
  | 'broadcast'
  | 'weather'
  | 'utility'
  | 'aviation'
  | 'other';

const disruptionSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum([
    'transit',
    'road',
    'event',
    'broadcast',
    'weather',
    'utility',
    'aviation',
    'other',
  ]),
  time: z.string().nullable().optional().default(null),
  source: z.string().nullable().optional().default(null),
});

const dayBundleSchema = z.object({
  date: z.string(),
  disruptions: z.array(disruptionSchema).max(8),
});

const responseSchema = z.object({
  today: dayBundleSchema,
  tomorrow: dayBundleSchema.nullable().optional().default(null),
});

export type Disruption = z.infer<typeof disruptionSchema>;
export type DayBundle = z.infer<typeof dayBundleSchema>;

export type LocalEventsResult = {
  today: DayBundle;
  tomorrow: DayBundle | null;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
};

const SYSTEM_NB = `Du er en filtreringsassistent som overvåker lokale forstyrrelser i en oppgitt by. Bruk websøk for å finne hendelser som faktisk kan påvirke en innbyggers vanlige rutine — IKKE som turistinformasjon, underholdning eller ting å gjøre.

INKLUDER kun hendelser som matcher MINST EN av disse kategoriene:
- transit: kollektivtransport-stenging, erstatningsbuss, streik eller store forsinkelser (T-bane, trikk, buss, tog, Vy, Ruter, Flytoget)
- road: vei-stenginger eller omkjøringer som varer ≥30 min i sentrale gater
- event: arrangementer som blokkerer gater eller fortau (maraton, opptog, demonstrasjon, festival, kongelig besøk)
- broadcast: planlagt varslingstest (Sivilforsvaret, Politiet, NRK varslingstest, kommunale varsler)
- weather: farevarsel fra Met på gult, oransje eller rødt nivå
- utility: større strøm- eller vannutfall som rammer byen
- aviation: flyplass-stenging eller masseinnstillinger (>20% av avganger)

UTELUKK ALLTID:
- Idrettsarrangementer, konserter, utstillinger, restaurantnyheter, "ting å gjøre"
- Generell turistinformasjon
- Hendelser som allerede er ferdige
- Hendelser utenfor den oppgitte byen
- Rykter, spekulasjoner eller hendelser uten en konkret kilde
- Tvilstilfeller — hvis du er i tvil, IKKE inkluder

Hver hendelse må kunne knyttes til en konkret kilde du fant i søket (f.eks. ruter.no, vegvesen.no, met.no, oslo.kommune.no, nrk.no, avinor.no). Hvis ingen pålitelig kilde finnes, hopp over hendelsen.

UTGANGSFORMAT (strikt JSON, ingen forklaring, ingen forord eller etterord):
{
  "today": {
    "date": "YYYY-MM-DD",
    "disruptions": [
      {
        "title": "kort konkret beskrivelse, maks 18 ord",
        "type": "transit" | "road" | "event" | "broadcast" | "weather" | "utility" | "aviation" | "other",
        "time": "kl 10–14" eller null,
        "source": "ruter.no" eller null
      }
    ]
  },
  "tomorrow": null ELLER samme struktur som today
}

Hvis ingen hendelser møter terskelen, returner tomme arrays — aldri lag opp innhold for å fylle plass.`;

const SYSTEM_EN = `You filter local disruptions for a given city. Use web search to find events that might actually break a resident's normal routine — NOT tourism, entertainment, or "things to do."

ONLY INCLUDE events matching at least one category:
- transit: closures, replacement buses, strikes, major delays (subway, tram, bus, train, regional rail)
- road: closures or major reroutes lasting ≥30 min in central streets
- event: events blocking streets or sidewalks (marathon, parade, protest, festival, royal visit)
- broadcast: scheduled emergency-broadcast test (civil defence, police, public broadcaster, municipal alert)
- weather: yellow/orange/red severe-weather warning from the national weather service
- utility: major power or water outage affecting the city
- aviation: airport closure or mass flight cancellations (>20%)

ALWAYS EXCLUDE:
- Sports games, concerts, exhibitions, restaurant news, "things to do"
- Generic tourism content
- Events that already ended
- Events outside the named city
- Rumours, speculation, or items without a concrete source
- Edge cases — when in doubt, leave it out

Each item must be traceable to a concrete source you found in the search. If you cannot find a reliable source, skip the item.

OUTPUT FORMAT (strict JSON, no preamble, no commentary):
{
  "today": {
    "date": "YYYY-MM-DD",
    "disruptions": [
      {
        "title": "short concrete description, max 18 words",
        "type": "transit" | "road" | "event" | "broadcast" | "weather" | "utility" | "aviation" | "other",
        "time": "10:00–14:00" or null,
        "source": "e.g. ruter.no" or null
      }
    ]
  },
  "tomorrow": null OR same shape as today
}

If nothing meets the threshold, return empty arrays — never invent content to fill space.`;

export async function fetchLocalDisruptions(opts: {
  city: string;
  todayDate: string;
  tomorrowDate?: string | null;
  locale: Locale;
}): Promise<LocalEventsResult> {
  const client = getClaude();
  const system = opts.locale === 'en' ? SYSTEM_EN : SYSTEM_NB;
  const userMessage = buildUserMessage(opts);

  const res = await client.messages.create({
    model: MODELS.morningBriefing,
    max_tokens: 1500,
    // Server-side web_search: Anthropic runs the searches and feeds
    // results back to the model in the same turn, so we get the
    // final filtered JSON without orchestrating a tool loop ourselves.
    tools: [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 3,
      },
    ] as unknown as Anthropic.Messages.Tool[],
    system,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = res.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();

  const empty: DayBundle = { date: opts.todayDate, disruptions: [] };
  let today: DayBundle = empty;
  let tomorrow: DayBundle | null = null;

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = responseSchema.parse(JSON.parse(jsonMatch[0]));
      today = parsed.today;
      tomorrow = parsed.tomorrow ?? null;
    } catch (err) {
      console.error('[local-events] failed to parse model output', err, text.slice(0, 200));
    }
  }

  const tokensIn = res.usage.input_tokens;
  const tokensOut = res.usage.output_tokens;
  return {
    today,
    tomorrow,
    tokensIn,
    tokensOut,
    costUsd: estimateCostUsd(MODELS.morningBriefing, tokensIn, tokensOut),
  };
}

function buildUserMessage(opts: {
  city: string;
  todayDate: string;
  tomorrowDate?: string | null;
  locale: Locale;
}): string {
  if (opts.locale === 'en') {
    return [
      `City: ${opts.city}`,
      `Today: ${opts.todayDate}`,
      opts.tomorrowDate ? `Tomorrow: ${opts.tomorrowDate}` : '',
      '',
      `Search for disruptions in ${opts.city} for the listed dates.`,
      opts.tomorrowDate
        ? 'Include both today and tomorrow. If tomorrow has no qualifying disruptions, return tomorrow with an empty array (not null).'
        : 'Set tomorrow to null.',
      'Return strict JSON only.',
    ]
      .filter(Boolean)
      .join('\n');
  }
  return [
    `By: ${opts.city}`,
    `I dag: ${opts.todayDate}`,
    opts.tomorrowDate ? `I morgen: ${opts.tomorrowDate}` : '',
    '',
    `Søk etter forstyrrelser i ${opts.city} for datoene over.`,
    opts.tomorrowDate
      ? 'Inkluder både i dag og i morgen. Hvis i morgen ikke har kvalifiserende hendelser, returner tomorrow med tomt array (ikke null).'
      : 'Sett tomorrow til null.',
    'Returner kun JSON.',
  ]
    .filter(Boolean)
    .join('\n');
}
