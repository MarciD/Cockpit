"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toaster } from "./notification-toaster";
import { useNotifications } from "./use-notifications";

const TOAST_MS = 6000;

/**
 * Mounted once per page. Turns rows that arrived since the previous poll into
 * toasts and mirrors the unread count onto the installed app's badge. The
 * first payload only sets the watermark, so an old backlog never toasts.
 */
export function NotificationWatch() {
  const router = useRouter();
  const { items, unread, updatedAt } = useNotifications();
  const watermark = useRef<string | null>(null);

  useEffect(() => {
    if (!updatedAt) return;
    const newest = items[0]?.createdAt ?? null;
    if (watermark.current === null) {
      watermark.current = newest ?? new Date(0).toISOString();
      return;
    }
    const fresh = items.filter(
      (n) => !n.readAt && n.createdAt > (watermark.current as string),
    );
    // Deferred: creating a toast synchronously inside an effect makes the
    // toaster flushSync while React is still rendering (React 19 warns).
    const timer = setTimeout(() => {
      for (const n of fresh.reverse()) {
        toaster.create({
          id: n.id,
          title: n.title,
          description: n.body ?? undefined,
          type: n.severity === "urgent" ? "error" : "info",
          duration: n.severity === "urgent" ? Infinity : TOAST_MS,
          closable: true,
          action: n.url
            ? { label: "Open", onClick: () => router.push(n.url as string) }
            : undefined,
        });
      }
    }, 0);
    if (newest && newest > watermark.current) watermark.current = newest;
    return () => clearTimeout(timer);
  }, [items, updatedAt, router]);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const nav = navigator as Navigator & {
      setAppBadge?: (n: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (unread > 0) void nav.setAppBadge?.(unread).catch(() => {});
    else void nav.clearAppBadge?.().catch(() => {});
  }, [unread]);

  return null;
}
