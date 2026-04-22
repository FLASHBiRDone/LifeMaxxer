'use client';

import { useEffect, useRef, useState } from 'react';
import { LOADING_MESSAGES, type LoadingContext } from '@/lib/loading-messages';
import { cn } from '@/lib/cn';

function shuffle<T>(arr: readonly T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Cycles through context-specific loading phrases with a fade animation.
 * Uses the "bag" shuffle pattern: every phrase appears exactly once per
 * pass before any repeats, with re-shuffle nudging to avoid the last
 * phrase of the previous pass being the first of the next.
 */
export function LoadingMessage({
  context,
  intervalMs = 3500,
  className,
}: {
  context: LoadingContext;
  intervalMs?: number;
  className?: string;
}) {
  const phrases = LOADING_MESSAGES[context];
  const queueRef = useRef<string[]>(shuffle(phrases));
  const [index, setIndex] = useState(0);

  useEffect(() => {
    queueRef.current = shuffle(phrases);
    setIndex(0);
  }, [context, phrases]);

  useEffect(() => {
    if (phrases.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((prev) => {
        const next = prev + 1;
        if (next < queueRef.current.length) return next;
        // Reshuffle; prevent the previous last phrase from being the next first.
        const last = queueRef.current[queueRef.current.length - 1];
        let reshuffled = shuffle(phrases);
        if (reshuffled.length > 1 && reshuffled[0] === last) {
          [reshuffled[0], reshuffled[1]] = [reshuffled[1], reshuffled[0]];
        }
        queueRef.current = reshuffled;
        return 0;
      });
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [phrases, intervalMs]);

  const current = queueRef.current[index] ?? phrases[0];

  return (
    <span
      key={`${context}-${index}`}
      className={cn('inline-block animate-fade-up', className)}
    >
      {current}
    </span>
  );
}
