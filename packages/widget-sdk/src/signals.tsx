"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Signal } from "./index";

export interface SignalStore {
  emit: (signal: Signal) => void;
  /** Drop signals from a source (optionally only one type) — e.g. on unmount. */
  remove: (source: string, type?: string) => void;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => readonly Signal[];
}

/**
 * In-memory, session-scoped signal store. Latest-wins per (source, type) so a
 * widget re-emitting `widget:context` updates in place. `getSnapshot` returns a
 * cached array (rebuilt only on change) so `useSyncExternalStore` is stable.
 */
function createSignalStore(): SignalStore {
  const map = new Map<string, Signal>();
  const listeners = new Set<() => void>();
  let snapshot: readonly Signal[] = [];

  const rebuild = () => {
    snapshot = Array.from(map.values());
    for (const listener of listeners) listener();
  };

  return {
    emit(signal) {
      map.set(`${signal.source}::${signal.type}`, signal);
      rebuild();
    },
    remove(source, type) {
      let changed = false;
      for (const key of Array.from(map.keys())) {
        const sep = key.indexOf("::");
        const s = key.slice(0, sep);
        const t = key.slice(sep + 2);
        if (s === source && (type === undefined || t === type)) {
          map.delete(key);
          changed = true;
        }
      }
      if (changed) rebuild();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return snapshot;
    },
  };
}

const SignalContext = createContext<SignalStore | null>(null);

/** Desk-scoped signal bus. A fresh store per `deskId` — signals never bleed. */
export function SignalsProvider({
  deskId,
  children,
}: {
  deskId: string;
  children: ReactNode;
}) {
  const store = useMemo(() => createSignalStore(), [deskId]);
  return (
    <SignalContext.Provider value={store}>{children}</SignalContext.Provider>
  );
}

function useStore(): SignalStore {
  const store = useContext(SignalContext);
  if (!store) {
    throw new Error("Signal hooks must be used within a <SignalsProvider>");
  }
  return store;
}

export function useSignalStore(): SignalStore {
  return useStore();
}

export function useEmitSignal(): (signal: Signal) => void {
  return useStore().emit;
}

/** Subscribe to the current desk's signals (re-renders on change). */
export function useSignals(): readonly Signal[] {
  const store = useStore();
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
}
