'use client';

import { useState } from 'react';
import { Loader2, LogOut } from 'lucide-react';

/**
 * Client-side sign-out so we can wipe the service worker's
 * cached RSC/API responses *before* the cookie is cleared. Without
 * this the next user on a shared device can briefly see the previous
 * user's `/today` page from the SW cache while the server is being
 * re-fetched (worse offline, where the stale cache is the only thing
 * served).
 */
export function SignOutButton() {
  const [pending, setPending] = useState(false);

  async function signOut() {
    if (pending) return;
    setPending(true);
    try {
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready;
          reg.active?.postMessage({ type: 'CLEAR_SESSION_CACHE' });
        } catch {
          /* if the SW isn't ready, the supabase signOut still wipes
             the cookie — defense in depth, not the only defense */
        }
      }
      await fetch('/auth/signout', { method: 'POST', redirect: 'manual' });
    } finally {
      // Hard nav so any in-memory React state from the prior session
      // is dropped along with the cookie.
      window.location.href = '/login';
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className="w-full rounded-2xl border border-destructive/30 bg-card text-destructive py-3 text-sm font-medium flex items-center justify-center gap-2 hover:bg-destructive/5 transition-colors disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      Logg ut
    </button>
  );
}
