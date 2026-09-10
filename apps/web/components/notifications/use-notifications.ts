"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { InboxDto, NotificationDto } from "@/lib/notifications/dto";

export const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;

/** Every 30 s while a tab is open, plus a catch-up whenever it regains focus. */
const POLL_MS = 30_000;
const JSON_HEADERS = { "content-type": "application/json" };

async function fetchInbox(signal: AbortSignal): Promise<InboxDto> {
  const res = await fetch("/api/notifications", { signal });
  if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})`);
  return (await res.json()) as InboxDto;
}

/**
 * One shared query for the bell, the inbox and the toaster. Several mounted
 * consumers still mean a single poll — TanStack dedupes on the key.
 */
export function useNotifications() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: ({ signal }) => fetchInbox(signal),
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }),
    [queryClient],
  );

  const setRead = useCallback(
    async (id: string, read = true) => {
      await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ read }),
      });
      await refresh();
    },
    [refresh],
  );

  const dismiss = useCallback(
    async (id: string) => {
      await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ dismissed: true }),
      });
      await refresh();
    },
    [refresh],
  );

  const markAllRead = useCallback(async () => {
    await fetch("/api/notifications/read-all", { method: "POST" });
    await refresh();
  }, [refresh]);

  const sendTest = useCallback(async () => {
    await fetch("/api/notifications/test", { method: "POST" });
    await refresh();
  }, [refresh]);

  const items: NotificationDto[] = query.data?.notifications ?? [];
  return {
    items,
    unread: query.data?.unread ?? 0,
    updatedAt: query.dataUpdatedAt,
    isLoading: query.isPending,
    isError: query.isError,
    setRead,
    dismiss,
    markAllRead,
    sendTest,
  };
}
