"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { defineWidget, type WidgetComponentProps } from "@cockpit/widget-sdk";
import {
  configSchema,
  defaultConfig,
  type RecurringTasksConfig as Config,
} from "./config";

interface Task {
  id: string;
  title: string;
  cron: string;
  nextRunAt: string | null;
  enabled: boolean;
}
interface Data {
  profileId: string;
  tasks: Task[];
}

const JSON_HEADERS = { "content-type": "application/json" };

function formatNext(iso: string): string {
  return new Date(iso).toLocaleString([], {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Panel({ data }: WidgetComponentProps<Config, Data>) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [cron, setCron] = useState("0 9 * * 1");

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: ["recurring-tasks", data.profileId],
    });

  async function add() {
    if (!title.trim() || !cron.trim()) return;
    await fetch("/api/w/recurring-tasks", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ profileId: data.profileId, title, cron }),
    });
    setTitle("");
    await refresh();
  }

  async function toggle(id: string, enabled: boolean) {
    await fetch(`/api/w/recurring-tasks/${id}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ enabled }),
    });
    await refresh();
  }

  async function remove(id: string) {
    await fetch(`/api/w/recurring-tasks/${id}`, { method: "DELETE" });
    await refresh();
  }

  return (
    <Stack gap="3" w="100%">
      {data.tasks.length === 0 ? (
        <Text fontSize="sm" color="fg.muted">
          No recurring tasks yet.
        </Text>
      ) : (
        <Stack gap="2.5">
          {data.tasks.map((task) => (
            <HStack key={task.id} gap="2.5" align="center" w="100%">
              <input
                type="checkbox"
                checked={task.enabled}
                onChange={(e) => toggle(task.id, e.target.checked)}
                aria-label={task.enabled ? "Disable task" : "Enable task"}
                style={{
                  width: 15,
                  height: 15,
                  accentColor: "var(--accent)",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              />
              <Stack gap="0" flex="1" minW="0">
                <Text
                  fontSize="sm"
                  color={task.enabled ? "fg" : "fg.faint"}
                  lineClamp={1}
                >
                  {task.title}
                </Text>
                <Text textStyle="meta">
                  {task.cron}
                  {task.nextRunAt
                    ? ` · next ${formatNext(task.nextRunAt)}`
                    : ""}
                </Text>
              </Stack>
              <Button
                size="xs"
                variant="ghost"
                color="fg.faint"
                _hover={{ color: "danger" }}
                onClick={() => remove(task.id)}
                aria-label="Remove task"
              >
                ✕
              </Button>
            </HStack>
          ))}
        </Stack>
      )}

      <HStack gap="2" pt="1">
        <Input
          size="xs"
          placeholder="New task…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Input
          size="xs"
          w="110px"
          placeholder="cron"
          value={cron}
          onChange={(e) => setCron(e.target.value)}
        />
        <Button
          size="xs"
          bg="accent"
          color="accent.fg"
          _hover={{ bg: "accent.solid" }}
          disabled={!title.trim() || !cron.trim()}
          onClick={add}
        >
          Add
        </Button>
      </HStack>
    </Stack>
  );
}

const recurringTasksWidget = defineWidget<Config, Data>({
  id: "recurring-tasks",
  title: "Recurring Tasks",
  description: "Cron-scheduled reminders for this desk.",
  icon: () => <span aria-hidden>↻</span>,
  category: "tasks",
  configSchema,
  defaultConfig,
  layout: { defaultW: 3, defaultH: 5, minW: 3, minH: 3, mobileH: 7 },
  data: {
    queryKey: (_config, profileId) => ["recurring-tasks", profileId],
    queryFn: async (ctx) => {
      const res = await fetch(
        `/api/w/recurring-tasks?profileId=${encodeURIComponent(ctx.profileId)}`,
        { signal: ctx.signal },
      );
      if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})`);
      const json = (await res.json()) as { tasks: Task[] };
      return { profileId: ctx.profileId, tasks: json.tasks };
    },
    staleTimeMs: 30_000,
  },
  count: (data) => (data.tasks.length > 0 ? data.tasks.length : undefined),
  describe: (_config, data) => {
    if (data.tasks.length === 0) return null;
    const enabled = data.tasks.filter((t) => t.enabled);
    return `${enabled.length} active recurring task${
      enabled.length === 1 ? "" : "s"
    } (of ${data.tasks.length}).`;
  },
  Component: Panel,
});

export default recurringTasksWidget;
