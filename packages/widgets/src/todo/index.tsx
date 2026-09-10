"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, HStack, Input, Stack, Text, chakra } from "@chakra-ui/react";
import { defineWidget, type WidgetComponentProps } from "@cockpit/widget-sdk";
import {
  configSchema,
  defaultConfig,
  type TodoConfig as Config,
} from "./config";

interface Todo {
  id: string;
  title: string;
  done: boolean;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  completedAt: string | null;
}
interface Data {
  profileId: string;
  todos: Todo[];
}

const JSON_HEADERS = { "content-type": "application/json" };
const NO_DAY = "none";

function fmt(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString([], { day: "2-digit", month: "short" })} ${d.toLocaleTimeString(
    [],
    { hour: "2-digit", minute: "2-digit" },
  )}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local calendar day of a Date, as `YYYY-MM-DD`. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Value for a native `<input type="date">` (local `YYYY-MM-DD`), "" when unset. */
function dateInputValue(iso: string | null): string {
  return iso ? dayKey(new Date(iso)) : "";
}

/** Friendly header for a solve-day group key ("Today"/"Tomorrow"/"Mon 14 Jul"). */
function dayLabel(key: string): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (key === dayKey(now)) return "Today";
  if (key === dayKey(tomorrow)) return "Tomorrow";
  return new Date(`${key}T00:00:00`).toLocaleDateString([], {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

interface DayGroup {
  key: string;
  label: string;
  todos: Todo[];
}

interface GroupOptions {
  getDate: (t: Todo) => string | null;
  order: "asc" | "desc";
  fallbackLabel: string;
}

/**
 * Bucket todos by the local calendar day of a chosen date. Undated todos are
 * collected under `fallbackLabel` and always rendered last. `order` sorts the
 * dated groups — ascending for upcoming solve days, descending for done dates.
 */
function groupByDay(items: Todo[], opts: GroupOptions): DayGroup[] {
  const byDay = new Map<string, Todo[]>();
  for (const t of items) {
    const iso = opts.getDate(t);
    const key = iso ? dayKey(new Date(iso)) : NO_DAY;
    const bucket = byDay.get(key);
    if (bucket) bucket.push(t);
    else byDay.set(key, [t]);
  }
  const dated = [...byDay.keys()].filter((k) => k !== NO_DAY).sort();
  if (opts.order === "desc") dated.reverse();
  const groups: DayGroup[] = dated.map((key) => ({
    key,
    label: dayLabel(key),
    todos: byDay.get(key) ?? [],
  }));
  const undated = byDay.get(NO_DAY);
  if (undated) {
    groups.push({ key: NO_DAY, label: opts.fallbackLabel, todos: undated });
  }
  return groups;
}

const GROUP_HEADER_PROPS = {
  fontFamily: "mono",
  fontSize: "2xs",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "fg.faint",
} as const;

function Panel({ data }: WidgetComponentProps<Config, Data>) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const cancelledRef = useRef(false);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["todos", data.profileId] });

  async function add() {
    if (!title.trim()) return;
    await fetch("/api/w/todo", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ profileId: data.profileId, title }),
    });
    setTitle("");
    await refresh();
  }

  async function toggle(id: string, done: boolean) {
    await fetch(`/api/w/todo/${id}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ done }),
    });
    await refresh();
  }

  async function updateTitle(id: string, next: string) {
    await fetch(`/api/w/todo/${id}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ title: next }),
    });
    await refresh();
  }

  async function updateDates(
    id: string,
    patch: { startDate?: string | null; endDate?: string | null },
  ) {
    await fetch(`/api/w/todo/${id}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify(patch),
    });
    await refresh();
  }

  async function remove(id: string) {
    await fetch(`/api/w/todo/${id}`, { method: "DELETE" });
    await refresh();
  }

  function startEdit(t: Todo) {
    cancelledRef.current = false;
    setDraft(t.title);
    setEditingId(t.id);
  }

  function commitTitle(t: Todo) {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setEditingId(null);
      return;
    }
    const next = draft.trim();
    setEditingId(null);
    if (next && next !== t.title) void updateTitle(t.id, next);
  }

  // A native date picker → local-midnight ISO, or null when cleared. Ignores an
  // edit that would invert the range (start after solve); the picker's min/max
  // prevents this in the UI, so this only guards a typed-in value.
  function onDateChange(
    t: Todo,
    field: "startDate" | "endDate",
    value: string,
  ) {
    const iso = value ? new Date(`${value}T00:00:00`).toISOString() : null;
    const other = field === "startDate" ? t.endDate : t.startDate;
    if (iso && other) {
      const start = field === "startDate" ? iso : other;
      const solve = field === "startDate" ? other : iso;
      if (new Date(start) > new Date(solve)) return;
    }
    void updateDates(t.id, { [field]: iso });
  }

  const dateField = (
    t: Todo,
    field: "startDate" | "endDate",
    label: string,
  ) => {
    // Constrain each picker to its sibling so start can never exceed solve.
    const min = field === "endDate" ? dateInputValue(t.startDate) : "";
    const max = field === "startDate" ? dateInputValue(t.endDate) : "";
    return (
      <HStack gap="1" align="center">
        <Text as="span" textStyle="meta">
          {label}
        </Text>
        <chakra.input
          type="date"
          value={dateInputValue(t[field])}
          min={min || undefined}
          max={max || undefined}
          onChange={(e) => onDateChange(t, field, e.target.value)}
          aria-label={`${label} date`}
          fontFamily="mono"
          fontSize="2xs"
          color="fg.muted"
          bg="transparent"
          borderWidth="1px"
          borderColor="border"
          borderRadius="sm"
          px="1"
          cursor="pointer"
          css={{ colorScheme: "light dark" }}
          _hover={{ color: "fg", borderColor: "fg.faint" }}
        />
      </HStack>
    );
  };

  const row = (t: Todo) => (
    <Stack key={t.id} gap="1" w="100%">
      <HStack gap="2.5" align="start" w="100%">
        <input
          type="checkbox"
          checked={t.done}
          onChange={(e) => toggle(t.id, e.target.checked)}
          aria-label={t.done ? "Mark not done" : "Mark done"}
          style={{
            width: 15,
            height: 15,
            marginTop: 2,
            accentColor: "var(--accent)",
            cursor: "pointer",
            flexShrink: 0,
          }}
        />
        <Stack gap="0" flex="1" minW="0">
          {editingId === t.id ? (
            <Input
              size="xs"
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => commitTitle(t)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                else if (e.key === "Escape") {
                  cancelledRef.current = true;
                  e.currentTarget.blur();
                }
              }}
              aria-label="Edit to-do message"
            />
          ) : (
            <Text
              fontSize="sm"
              lineClamp={2}
              color={t.done ? "fg.faint" : "fg"}
              textDecoration={t.done ? "line-through" : "none"}
              cursor="text"
              onClick={() => startEdit(t)}
              title="Click to edit"
            >
              {t.title}
            </Text>
          )}
          <Text textStyle="meta">
            {t.done
              ? `done ${t.completedAt ? fmt(t.completedAt) : "—"}`
              : `added ${fmt(t.createdAt)}`}
          </Text>
        </Stack>
        <Button
          size="xs"
          variant="ghost"
          color="fg.faint"
          _hover={{ color: "danger" }}
          onClick={() => remove(t.id)}
          aria-label="Delete to-do"
        >
          ✕
        </Button>
      </HStack>
      <HStack gap="3" pl="6" flexWrap="wrap">
        {dateField(t, "startDate", "start")}
        {dateField(t, "endDate", "solve")}
      </HStack>
    </Stack>
  );

  const open = data.todos.filter((t) => !t.done);
  const done = data.todos.filter((t) => t.done);
  const openGroups = groupByDay(open, {
    getDate: (t) => t.endDate,
    order: "asc",
    fallbackLabel: "No solve day",
  });
  const doneGroups = groupByDay(done, {
    getDate: (t) => t.endDate ?? t.completedAt,
    order: "desc",
    fallbackLabel: "No date",
  });

  return (
    <Stack gap="3" h="100%" w="100%">
      <Stack gap="2.5" flex="1" overflowY="auto" minH="0">
        {open.length === 0 && done.length === 0 ? (
          <Text fontSize="sm" color="fg.muted">
            Nothing to do. Nice.
          </Text>
        ) : (
          <>
            {open.length === 0 ? (
              <Text fontSize="sm" color="fg.muted">
                All done — nice.
              </Text>
            ) : (
              openGroups.map((g) => (
                <Stack key={g.key} gap="2.5">
                  <Text {...GROUP_HEADER_PROPS}>{g.label}</Text>
                  {g.todos.map(row)}
                </Stack>
              ))
            )}
            {done.length > 0 ? (
              <chakra.button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                alignSelf="flex-start"
                mt="1"
                fontFamily="mono"
                fontSize="2xs"
                letterSpacing="0.12em"
                textTransform="uppercase"
                color="fg.faint"
                cursor="pointer"
                _hover={{ color: "fg.muted" }}
              >
                {showDone
                  ? "Hide completed"
                  : `Show completed (${done.length})`}
              </chakra.button>
            ) : null}
            {showDone
              ? doneGroups.map((g) => (
                  <Stack key={g.key} gap="2.5">
                    <Text {...GROUP_HEADER_PROPS}>{g.label}</Text>
                    {g.todos.map(row)}
                  </Stack>
                ))
              : null}
          </>
        )}
      </Stack>

      <HStack gap="2" flexShrink={0}>
        <Input
          size="xs"
          placeholder="Add a to-do…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void add();
          }}
        />
        <Button
          size="xs"
          bg="accent"
          color="accent.fg"
          _hover={{ bg: "accent.solid" }}
          disabled={!title.trim()}
          onClick={add}
        >
          Add
        </Button>
      </HStack>
    </Stack>
  );
}

const todoWidget = defineWidget<Config, Data>({
  id: "todo",
  title: "To-do",
  description: "A simple local checklist for this desk.",
  icon: () => <span aria-hidden>☑</span>,
  category: "tasks",
  configSchema,
  defaultConfig,
  layout: { defaultW: 3, defaultH: 5, minW: 3, minH: 3, mobileH: 7 },
  data: {
    queryKey: (_config, profileId) => ["todos", profileId],
    queryFn: async (ctx) => {
      const res = await fetch(
        `/api/w/todo?profileId=${encodeURIComponent(ctx.profileId)}`,
        { signal: ctx.signal },
      );
      if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})`);
      const json = (await res.json()) as { todos: Todo[] };
      return { profileId: ctx.profileId, todos: json.todos };
    },
    staleTimeMs: 30_000,
  },
  count: (data) => {
    const open = data.todos.filter((t) => !t.done).length;
    return open > 0 ? open : undefined;
  },
  describe: (_config, data) => {
    const open = data.todos.filter((t) => !t.done);
    if (open.length === 0) return data.todos.length ? "All to-dos done." : null;
    return `${open.length} open to-do${open.length === 1 ? "" : "s"}: ${open
      .slice(0, 3)
      .map((t) => t.title)
      .join("; ")}${open.length > 3 ? "…" : ""}.`;
  },
  Component: Panel,
});

export default todoWidget;
