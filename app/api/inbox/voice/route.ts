import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { serverEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_BYTES = 25 * 1024 * 1024; // OpenAI Whisper hard limit

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!serverEnv.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'Stemmeopptak er ikke konfigurert.' },
      { status: 503 },
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('audio');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'mangler lydfil' }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'lydfil for stor eller tom' }, { status: 400 });
  }
  // Reject anything that isn't an audio payload. Whisper would
  // reject server-side anyway, but only after we've already paid for
  // the upload bandwidth and the API call. The check also prevents
  // someone using this endpoint to launder arbitrary blobs through
  // OpenAI on our budget.
  if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
    return NextResponse.json(
      { error: 'støttede formater: lyd eller video' },
      { status: 415 },
    );
  }

  // Sanitize the upstream filename: drop path separators and control
  // chars, keep just an extension if the client supplied one.
  const safeName = (() => {
    const raw = typeof file.name === 'string' ? file.name : '';
    const cleaned = raw.replace(/[\x00-\x1F"'`<>\/\\]/g, '').slice(0, 64);
    return cleaned && cleaned.includes('.') ? cleaned : 'voice.webm';
  })();

  const upstream = new FormData();
  upstream.append('file', file, safeName);
  upstream.append('model', 'whisper-1');
  upstream.append('language', 'no');
  upstream.append('response_format', 'json');

  try {
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${serverEnv.OPENAI_API_KEY}` },
      body: upstream,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[voice] whisper failed', res.status, detail);
      return NextResponse.json(
        { error: 'Transkribering feilet.' },
        { status: 502 },
      );
    }
    const data = (await res.json()) as { text?: string };
    const text = (data.text ?? '').trim();
    if (!text) {
      return NextResponse.json({ error: 'Ingen tale oppdaget.' }, { status: 422 });
    }
    return NextResponse.json({ text });
  } catch (err) {
    console.error('[voice] request failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Noe gikk galt' },
      { status: 500 },
    );
  }
}
