"use client";

import { useCallback, useEffect, useState } from "react";

// Bump the version segment to invalidate persisted shapes after a breaking
// change to what we store (e.g. the session/cursor layout).
const PREFIX = "cockpit:ll:v1:";

/** Storage key for the active learning session of a (profile, language) pair. */
export function sessionStorageKey(profileId: string, language: string): string {
  return `session:${profileId}:${language}`;
}

function read<T>(key: string): T | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? undefined : (JSON.parse(raw) as T);
  } catch {
    return undefined; // unparseable / storage blocked (private mode)
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    if (value == null) window.localStorage.removeItem(PREFIX + key);
    else window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // ignore quota / disabled storage — persistence is best-effort
  }
}

/** Clear a persisted key (used by the error-boundary "Start over" action). */
export function clearPersisted(key: string): void {
  write(key, null);
}

/**
 * useState that write-throughs to localStorage and rehydrates on mount, so an
 * interrupted session (crash, reload, navigation) can be restored. Hydration
 * runs in an effect — never during render — to avoid SSR/client mismatch.
 * Setting the value to null/undefined removes the stored entry.
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    const stored = read<T>(key);
    if (stored !== undefined) setValue(stored);
  }, [key]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        write(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  return [value, set];
}
