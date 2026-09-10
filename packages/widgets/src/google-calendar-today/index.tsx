"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, HStack, Link, Stack, Text, chakra } from "@chakra-ui/react";
import { defineWidget, type WidgetComponentProps } from "@cockpit/widget-sdk";
import {
  configSchema,
  defaultConfig,
  type CalendarConfig as Config,
} from "./config";
import { ConnectPrompt } from "../lib/connect";
import { CalendarSettings } from "./settings";

interface CalEvent {
  id: string;
  calendarId: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  videoUrl?: string;
  location?: string;
}
interface CalMeta {
  id: string;
  label: string;
  color: string;
  source: string;
}
interface Data {
  configured: boolean;
  calendars?: CalMeta[];
  items?: CalEvent[];
  error?: string;
}

type CalView = "day" | "week" | "month";
const VIEWS: [CalView, string][] = [
  ["day", "Day"],
  ["week", "Week"],
  ["month", "Month"],
];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function EventRow({
  ev,
  color,
  highlight,
}: {
  ev: CalEvent;
  color: string;
  highlight: boolean;
}) {
  return (
    <HStack gap="2.5" align="start" w="100%">
      <Box
        boxSize="7px"
        mt="1.5"
        borderRadius="full"
        bg={color}
        flexShrink={0}
      />
      <Text
        textStyle="meta"
        minW="46px"
        flexShrink={0}
        color={highlight ? "accent.solid" : "fg.muted"}
      >
        {ev.allDay ? "all day" : formatTime(ev.start)}
      </Text>
      <Text
        flex="1"
        minW="0"
        fontSize="sm"
        lineClamp={1}
        color={highlight ? "accent.solid" : "fg"}
        fontWeight={highlight ? "medium" : "normal"}
      >
        {ev.title}
      </Text>
      {ev.videoUrl ? (
        <Link
          href={ev.videoUrl}
          target="_blank"
          rel="noreferrer"
          flexShrink={0}
          fontFamily="mono"
          fontSize="2xs"
          letterSpacing="0.08em"
          textTransform="uppercase"
          color="link"
        >
          Join
        </Link>
      ) : null}
    </HStack>
  );
}

function Panel({ data, onOpenSettings }: WidgetComponentProps<Config, Data>) {
  const [view, setView] = useState<CalView>("day");
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const tz = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );

  // Day uses the widget's own (SDK) data; week/month self-fetch by range.
  const viewQuery = useQuery({
    queryKey: ["calendar-view", view, tz],
    queryFn: async ({ signal }) => {
      const res = await fetch(
        `/api/w/google-calendar-today?view=${view}&tz=${encodeURIComponent(tz)}`,
        { signal },
      );
      if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})`);
      return (await res.json()) as Data;
    },
    enabled: view !== "day",
    staleTime: 5 * 60_000,
  });

  const payload: Data =
    view === "day"
      ? data
      : (viewQuery.data ?? {
          configured: data.configured,
          calendars: data.calendars,
        });

  if (!payload.configured) {
    return <ConnectPrompt label="Calendars" onConnect={onOpenSettings} />;
  }

  const calendars = payload.calendars ?? data.calendars ?? [];
  const colorOf = (id: string) =>
    calendars.find((c) => c.id === id)?.color ?? "var(--accent)";
  const loading = view !== "day" && viewQuery.isPending;
  const events = (payload.items ?? []).filter((e) => !hidden[e.calendarId]);

  const nowMs = Date.now();
  const nextId =
    view === "day"
      ? events.find((e) => new Date(e.end).getTime() >= nowMs)?.id
      : undefined;

  // Group by local day for week/month.
  const groups: { key: string; label: string; events: CalEvent[] }[] = [];
  if (view !== "day") {
    for (const e of events) {
      const key = new Date(e.start).toDateString();
      let g = groups[groups.length - 1];
      if (!g || g.key !== key) {
        g = { key, label: dayLabel(e.start), events: [] };
        groups.push(g);
      }
      g.events.push(e);
    }
  }

  return (
    <Stack gap="3" h="100%" w="100%">
      <HStack justify="space-between" flexShrink={0}>
        <HStack layerStyle="inset" borderRadius="control" p="3px">
          {VIEWS.map(([v, label]) => (
            <chakra.button
              key={v}
              type="button"
              onClick={() => setView(v)}
              layerStyle={view === v ? "raised" : undefined}
              px="10px"
              py="4px"
              borderRadius="16px"
              fontFamily="body"
              fontSize="10px"
              fontWeight="medium"
              letterSpacing="0.08em"
              textTransform="uppercase"
              color={view === v ? "fg" : "fg.muted"}
              cursor="pointer"
            >
              {label}
            </chakra.button>
          ))}
        </HStack>
        <chakra.button
          type="button"
          aria-label="Manage calendars"
          onClick={onOpenSettings}
          color="fg.faint"
          fontSize="13px"
          lineHeight="1"
          cursor="pointer"
          _hover={{ color: "fg" }}
        >
          ⚙
        </chakra.button>
      </HStack>

      {calendars.length > 1 ? (
        <HStack gap="2" wrap="wrap" flexShrink={0}>
          {calendars.map((c) => {
            const on = !hidden[c.id];
            return (
              <chakra.button
                key={c.id}
                type="button"
                onClick={() => setHidden((h) => ({ ...h, [c.id]: !h[c.id] }))}
                display="flex"
                alignItems="center"
                gap="1.5"
                px="7px"
                py="2px"
                borderRadius="pill"
                bg="bg.subtle"
                opacity={on ? 1 : 0.4}
                cursor="pointer"
                aria-pressed={on}
              >
                <Box boxSize="7px" borderRadius="full" bg={c.color} />
                <Text fontSize="2xs" color="fg.muted">
                  {c.label}
                </Text>
              </chakra.button>
            );
          })}
        </HStack>
      ) : null}

      <Stack gap="2.5" flex="1" overflowY="auto" minH="0">
        {loading ? (
          <Text fontSize="sm" color="fg.muted">
            Loading…
          </Text>
        ) : events.length === 0 ? (
          <Text fontSize="sm" color="fg.muted">
            {view === "day" ? "No meetings today." : `No events this ${view}.`}
          </Text>
        ) : view === "day" ? (
          events.map((e) => (
            <EventRow
              key={e.id}
              ev={e}
              color={colorOf(e.calendarId)}
              highlight={e.id === nextId}
            />
          ))
        ) : (
          groups.map((g) => (
            <Stack key={g.key} gap="1.5">
              <Text textStyle="label">{g.label}</Text>
              {g.events.map((e) => (
                <EventRow
                  key={e.id}
                  ev={e}
                  color={colorOf(e.calendarId)}
                  highlight={false}
                />
              ))}
            </Stack>
          ))
        )}
      </Stack>
    </Stack>
  );
}

const googleCalendarTodayWidget = defineWidget<Config, Data>({
  id: "google-calendar-today",
  title: "Calendar",
  description: "Your calendars — day, week or month, with join links.",
  icon: () => <span aria-hidden>◷</span>,
  category: "calendar",
  configSchema,
  defaultConfig,
  SettingsComponent: CalendarSettings,
  layout: { defaultW: 3, defaultH: 6, minW: 3, minH: 4, mobileH: 7 },
  data: {
    queryKey: (_config, profileId) => ["calendar", profileId],
    queryFn: async (ctx) => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch(
        `/api/w/google-calendar-today?view=day&tz=${encodeURIComponent(tz)}${ctx.force ? "&refresh=1" : ""}`,
        { signal: ctx.signal },
      );
      if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})`);
      return (await res.json()) as Data;
    },
    refetchIntervalMs: 10 * 60_000,
    staleTimeMs: 5 * 60_000,
    manualRefresh: true,
  },
  count: (data) =>
    data.items && data.items.length > 0 ? data.items.length : undefined,
  describe: (_config, data) => {
    if (!data.configured) return null;
    const items = data.items ?? [];
    if (items.length === 0) return "No meetings today.";
    const now = Date.now();
    const next = items.find((e) => new Date(e.end).getTime() >= now);
    return `${items.length} meeting${items.length === 1 ? "" : "s"} today${
      next
        ? `; next: ${next.title}${next.allDay ? "" : ` at ${formatTime(next.start)}`}`
        : ""
    }.`;
  },
  Component: Panel,
});

export default googleCalendarTodayWidget;
