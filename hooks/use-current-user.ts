"use client";

import { useEffect, useState } from "react";

export type CurrentUser = { id: string; name: string };

/**
 * Reads the signed-in user from the server on mount. `loaded` stays false
 * until the check completes so callers can render a skeleton instead of
 * flashing an incorrect signed-out state.
 *
 * If `initialUser` is passed (resolved server-side from the request's
 * session cookie, e.g. via `getCurrentUser()` in a server component), it is
 * treated as already-verified truth and no client-side fetch is made at all
 * — this avoids any possibility of a stale/cached client fetch showing the
 * wrong signed-in state.
 */
export function useCurrentUser(initialUser?: CurrentUser | null) {
  const hasInitial = initialUser !== undefined;
  const [user, setUser] = useState<CurrentUser | null>(initialUser ?? null);
  const [loaded, setLoaded] = useState(hasInitial);

  useEffect(() => {
    if (hasInitial) return;

    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user, loaded };
}
