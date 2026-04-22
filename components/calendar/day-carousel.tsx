'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

type Day = {
  iso: string;
  dayNum: number;
  dayShort: string;
  isToday: boolean;
  offset: number;
};

const VISIBLE_RADIUS = 6; // tiles rendered on each side of center
const TILE_WIDTH = 56; // px, base width per tile
const SNAP_MS = 260;
const MAX_DRAG_PER_GESTURE = 14; // clamp to avoid insane fling distances

function addDaysIso(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function buildDays(centerIso: string, todayIso: string): Day[] {
  const out: Day[] = [];
  for (let delta = -VISIBLE_RADIUS; delta <= VISIBLE_RADIUS; delta++) {
    const iso = addDaysIso(centerIso, delta);
    const d = new Date(`${iso}T12:00:00Z`);
    out.push({
      iso,
      offset: delta,
      dayNum: d.getUTCDate(),
      dayShort: d
        .toLocaleDateString('nb-NO', { weekday: 'short', timeZone: 'Europe/Oslo' })
        .replace('.', '')
        .slice(0, 3),
      isToday: iso === todayIso,
    });
  }
  return out;
}

export function DayCarousel({
  dateString,
  todayString,
}: {
  dateString: string;
  todayString: string;
}) {
  const router = useRouter();

  // Local tracking of the active iso — updated optimistically so the
  // animation doesn't wait for the server round-trip.
  const [activeIso, setActiveIso] = useState(dateString);

  // Reset local state when the server-supplied date changes (e.g. user
  // navigated here with a different ?date=).
  if (activeIso !== dateString) {
    // Only reset when the prop actually changed under us, not when our
    // local optimistic update is still settling.
    // We use a ref below to track which case we're in.
  }
  const lastPropDate = useRef(dateString);
  useEffect(() => {
    if (lastPropDate.current !== dateString) {
      lastPropDate.current = dateString;
      setActiveIso(dateString);
    }
  }, [dateString]);

  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const pointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startDragOffsetRef = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const days = buildDays(activeIso, todayString);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerIdRef.current = e.pointerId;
    startXRef.current = e.clientX;
    startDragOffsetRef.current = dragOffset;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || pointerIdRef.current !== e.pointerId) return;
    const dx = e.clientX - startXRef.current;
    const clamped = Math.max(
      -TILE_WIDTH * MAX_DRAG_PER_GESTURE,
      Math.min(TILE_WIDTH * MAX_DRAG_PER_GESTURE, dx + startDragOffsetRef.current),
    );
    setDragOffset(clamped);
  }

  function settle(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || pointerIdRef.current !== e.pointerId) return;
    const steps = Math.round(-dragOffset / TILE_WIDTH);
    setDragging(false);
    pointerIdRef.current = null;

    if (steps === 0) {
      setDragOffset(0);
      return;
    }

    // Animate the drag to the snapped position, then swap the center.
    // We set dragOffset to exactly -steps*TILE_WIDTH so CSS transitions
    // glide the remainder, then after the animation finishes we rebuild
    // around the new center with dragOffset=0 (instant swap at the same
    // visual location since the new center is where we just landed).
    const target = -steps * TILE_WIDTH;
    setDragOffset(target);
    const nextIso = addDaysIso(activeIso, steps);
    window.setTimeout(() => {
      setActiveIso(nextIso);
      setDragOffset(0);
      router.push(`/calendar?date=${nextIso}`, { scroll: false });
    }, SNAP_MS);
  }

  function step(delta: number) {
    if (dragging) return;
    setDragOffset(-delta * TILE_WIDTH);
    const nextIso = addDaysIso(activeIso, delta);
    window.setTimeout(() => {
      setActiveIso(nextIso);
      setDragOffset(0);
      router.push(`/calendar?date=${nextIso}`, { scroll: false });
    }, SNAP_MS);
  }

  const dragStep = dragOffset / TILE_WIDTH;

  return (
    <div className="relative">
      {/* Center highlight ring */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-16 w-16 rounded-2xl ring-2 ring-primary/30 bg-primary/5"
      />

      <div
        className="relative overflow-hidden select-none touch-pan-y"
        style={{ height: 92 }}
      >
        <div
          ref={trackRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={settle}
          onPointerCancel={settle}
          className="absolute inset-y-0 left-1/2 flex items-center"
          style={{
            transform: `translateX(calc(-50% + ${dragOffset}px))`,
            transition: dragging ? 'none' : `transform ${SNAP_MS}ms cubic-bezier(0.22, 0.8, 0.22, 1)`,
          }}
        >
          {days.map((d) => {
            // Visual offset from center (0 = dead center)
            const vo = d.offset - dragStep;
            const abs = Math.abs(vo);
            const scale = Math.max(0.55, 1 - abs * 0.14);
            const opacity = Math.max(0.28, 1 - abs * 0.22);
            const isCenter = abs < 0.5;

            return (
              <button
                key={d.iso}
                type="button"
                onClick={(e) => {
                  if (dragging) return;
                  e.preventDefault();
                  const delta = d.offset;
                  if (delta === 0) return;
                  step(delta);
                }}
                className={cn(
                  'flex flex-col items-center justify-center flex-shrink-0 rounded-2xl',
                  'transition-[color,background-color,border-color] duration-200',
                  isCenter
                    ? 'bg-card border-primary/40 border text-foreground soft-shadow'
                    : 'text-muted-foreground',
                  d.isToday && !isCenter && 'text-primary',
                )}
                style={{
                  width: TILE_WIDTH,
                  height: TILE_WIDTH,
                  margin: '0 4px',
                  transform: `scale(${scale})`,
                  opacity,
                  transition: dragging
                    ? 'none'
                    : `transform ${SNAP_MS}ms cubic-bezier(0.22, 0.8, 0.22, 1), opacity ${SNAP_MS}ms linear`,
                }}
              >
                <span
                  className={cn(
                    'text-[10px] font-semibold uppercase tracking-wider leading-none',
                    d.isToday && 'text-primary',
                  )}
                >
                  {d.dayShort}
                </span>
                <span
                  className={cn(
                    'text-lg font-bold tabular leading-tight mt-0.5',
                    isCenter && 'text-xl',
                  )}
                >
                  {d.dayNum}
                </span>
                {d.isToday && (
                  <span className="mt-0.5 h-1 w-1 rounded-full bg-primary" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Arrow controls */}
      <button
        type="button"
        onClick={() => step(-1)}
        aria-label="Forrige dag"
        className="absolute left-0 top-1/2 -translate-y-1/2 h-9 w-9 rounded-xl bg-card/80 border backdrop-blur hover:border-primary/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => step(1)}
        aria-label="Neste dag"
        className="absolute right-0 top-1/2 -translate-y-1/2 h-9 w-9 rounded-xl bg-card/80 border backdrop-blur hover:border-primary/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
