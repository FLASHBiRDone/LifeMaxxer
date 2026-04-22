'use client';

import { useEffect, useState } from 'react';
import { LOADING_MESSAGES, type LoadingContext } from '@/lib/loading-messages';
import { cn } from '@/lib/cn';

/**
 * Cycles through context-specific loading phrases with a fade animation,
 * so the user sees relevant progress hints instead of a single static
 * label during LLM waits. Intervals reflect typical LLM latency —
 * staggered so each phrase gets ~2s of attention across a 10-15s wait.
 */
export function LoadingMessage({
  context,
  intervalMs = 2200,
  className,
}: {
  context: LoadingContext;
  intervalMs?: number;
  className?: string;
}) {
  const phrases = LOADING_MESSAGES[context];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (phrases.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % phrases.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [phrases.length, intervalMs]);

  return (
    <span
      key={index}
      className={cn('inline-block animate-fade-up', className)}
    >
      {phrases[index]}
    </span>
  );
}
