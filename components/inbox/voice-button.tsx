'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type State = 'idle' | 'recording' | 'transcribing';

function pickMimeType(): string | null {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
  ];
  if (typeof MediaRecorder === 'undefined') return null;
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return null;
}

function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function VoiceButton({
  onTranscribed,
  onError,
  disabled,
}: {
  onTranscribed: (text: string) => void;
  onError?: (msg: string) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<State>('idle');
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function start() {
    const mime = pickMimeType();
    if (!mime) {
      onError?.('Nettleseren støtter ikke lydopptak.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => upload(mime);
      rec.start();
      setState('recording');
      setSeconds(0);
      tickRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      console.error(err);
      onError?.('Mikrofontilgang ble avslått.');
    }
  }

  function stop() {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function upload(mime: string) {
    setState('transcribing');
    try {
      const blob = new Blob(chunksRef.current, { type: mime });
      if (blob.size === 0) {
        setState('idle');
        return;
      }
      const ext = mime.includes('mp4') ? 'm4a' : 'webm';
      const file = new File([blob], `voice.${ext}`, { type: mime });
      const form = new FormData();
      form.append('audio', file);
      const res = await fetch('/api/inbox/voice', { method: 'POST', body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        onError?.(body.error ?? 'Kunne ikke transkribere.');
        return;
      }
      const { text } = (await res.json()) as { text: string };
      onTranscribed(text);
    } catch (err) {
      console.error(err);
      onError?.('Opptaket kunne ikke sendes.');
    } finally {
      setState('idle');
      setSeconds(0);
    }
  }

  if (state === 'transcribing') {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center gap-2 rounded-xl border bg-muted px-3 py-2 text-xs font-medium text-muted-foreground"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Skriver av...
      </button>
    );
  }

  if (state === 'recording') {
    return (
      <button
        type="button"
        onClick={stop}
        className="inline-flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75 animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
        </span>
        <Square className="h-3.5 w-3.5" />
        {fmtDuration(seconds)}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors',
        'hover:border-primary/40 hover:bg-primary/5 hover:text-primary',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
      aria-label="Snakk inn"
    >
      <Mic className="h-3.5 w-3.5" />
      Snakk
    </button>
  );
}
