import { z } from "zod";
import { Box, Flex, HStack, Link, Stack, Text } from "@chakra-ui/react";
import { defineWidget, type WidgetComponentProps } from "@cockpit/widget-sdk";
import { ConnectPrompt, ReconnectPrompt } from "../lib/connect";

const configSchema = z.object({});
type Config = z.infer<typeof configSchema>;

interface Issue {
  key: string;
  summary: string;
  status: string;
  url: string;
}
interface Data {
  configured: boolean;
  items?: Issue[];
  error?: string;
  authFailed?: boolean;
}

type Bucket = "arbeit" | "review" | "done" | "other";

const BUCKETS: { key: Bucket; label: string; color: string }[] = [
  { key: "arbeit", label: "In Progress", color: "status.review" },
  { key: "review", label: "Code Review", color: "status.waiting" },
  { key: "done", label: "Done", color: "status.merged" },
  { key: "other", label: "Other", color: "status.closed" },
];

/** Map a free-text Jira workflow status onto one of four coloured buckets. */
function bucketOf(status: string): Bucket {
  const s = status.toLowerCase();
  if (s.includes("review")) return "review";
  if (s.includes("progress") || s.includes("arbeit") || s.includes("doing")) {
    return "arbeit";
  }
  if (
    s.includes("done") ||
    s.includes("deploy") ||
    s.includes("closed") ||
    s.includes("resolved") ||
    s.includes("fertig")
  ) {
    return "done";
  }
  return "other";
}

const TAG_STYLE: Record<Bucket, { bg: string; fg: string }> = {
  arbeit: { bg: "accent.tint", fg: "accent.solid" },
  review: { bg: "rgba(201,154,62,.18)", fg: "#8a6620" },
  done: { bg: "rgba(75,125,82,.16)", fg: "#3c6543" },
  other: { bg: "bg.muted", fg: "fg.muted" },
};

function Panel({ data, onOpenSettings }: WidgetComponentProps<Config, Data>) {
  if (!data.configured)
    return <ConnectPrompt label="Jira" onConnect={onOpenSettings} />;
  if (data.authFailed) {
    return (
      <ReconnectPrompt
        label="Jira"
        detail={data.error}
        onReconnect={onOpenSettings}
      />
    );
  }

  const items = data.items ?? [];
  // A failed refresh still serves the last good cache — only fall back to the
  // bare error when there is nothing left to show.
  if (items.length === 0) {
    return data.error ? (
      <Text fontSize="sm" color="danger">
        {data.error}
      </Text>
    ) : (
      <Text fontSize="sm" color="fg.muted">
        Nothing assigned to you.
      </Text>
    );
  }

  const counts: Record<Bucket, number> = {
    arbeit: 0,
    review: 0,
    done: 0,
    other: 0,
  };
  for (const it of items) counts[bucketOf(it.status)] += 1;
  const present = BUCKETS.filter((b) => counts[b.key] > 0);
  const attention = items
    .filter((it) => bucketOf(it.status) !== "done")
    .slice(0, 4);

  return (
    <Stack gap="3" w="100%" h="100%">
      {data.error ? (
        <Text fontSize="xs" color="warning" flexShrink={0} lineClamp={2}>
          Showing cached data — {data.error}
        </Text>
      ) : null}
      <Flex
        h="8px"
        borderRadius="5px"
        overflow="hidden"
        gap="0.5"
        flexShrink={0}
      >
        {present.map((b) => (
          <Box
            key={b.key}
            flex={counts[b.key]}
            bg={b.color}
            borderRadius="2px"
          />
        ))}
      </Flex>

      <Flex wrap="wrap" columnGap="3.5" rowGap="2" flexShrink={0}>
        {present.map((b) => (
          <HStack key={b.key} gap="1.5">
            <Box boxSize="8px" borderRadius="full" bg={b.color} />
            <Text textStyle="label" color="fg.muted">
              {b.label}
            </Text>
            <Text textStyle="data" fontSize="11px" color="fg">
              {counts[b.key]}
            </Text>
          </HStack>
        ))}
      </Flex>

      <Text textStyle="label" flexShrink={0}>
        Needs your attention
      </Text>
      <Stack gap="3" flex="1" overflow="hidden">
        {attention.map((it) => {
          const tag = TAG_STYLE[bucketOf(it.status)];
          return (
            <HStack key={it.key} gap="3" align="center">
              <Stack gap="0" flex="1" minW="0">
                <Link
                  href={it.url}
                  target="_blank"
                  rel="noreferrer"
                  fontSize="13px"
                  color="fg"
                  display="block"
                  w="full"
                  textAlign="left"
                  whiteSpace="nowrap"
                  overflow="hidden"
                  textOverflow="ellipsis"
                >
                  {it.summary}
                </Link>
                <Text textStyle="meta">{it.key}</Text>
              </Stack>
              <Box
                as="span"
                flexShrink={0}
                bg={tag.bg}
                color={tag.fg}
                borderRadius="5px"
                px="8px"
                py="4px"
                fontSize="8.5px"
                fontWeight="medium"
                letterSpacing="0.1em"
                textTransform="uppercase"
                whiteSpace="nowrap"
              >
                {it.status}
              </Box>
            </HStack>
          );
        })}
      </Stack>

      {counts.done > 0 ? (
        <Text textStyle="meta" flexShrink={0}>
          +{counts.done} done
        </Text>
      ) : null}
    </Stack>
  );
}

const jiraMyIssuesWidget = defineWidget<Config, Data>({
  id: "jira-my-issues",
  title: "Jira Issues",
  description: "Issues assigned to you, most recently updated first.",
  icon: () => <span aria-hidden>▣</span>,
  category: "issues",
  configSchema,
  defaultConfig: {},
  connection: {
    provider: "jira",
    label: "Jira",
    fields: [
      { key: "site", label: "Site", placeholder: "your-org.atlassian.net" },
      { key: "email", label: "Email", placeholder: "you@company.com" },
      { key: "token", label: "API token", secret: true },
    ],
  },
  layout: { defaultW: 6, defaultH: 8, minW: 4, minH: 5, mobileH: 11 },
  data: {
    queryKey: (_config, profileId) => ["jira-my-issues", profileId],
    queryFn: async (ctx) => {
      const res = await fetch(
        `/api/jira/my-issues${ctx.force ? "?refresh=1" : ""}`,
        { signal: ctx.signal },
      );
      if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})`);
      return (await res.json()) as Data;
    },
    refetchIntervalMs: 5 * 60_000,
    staleTimeMs: 60_000,
  },
  count: (data) =>
    data.items && data.items.length > 0
      ? `${data.items.length} ASSIGNED`
      : undefined,
  describe: (_config, data) => {
    if (!data.configured) return null;
    if (data.authFailed) {
      return "Jira rejected the saved token — the widget needs reconnecting.";
    }
    const items = data.items ?? [];
    if (items.length === 0) return "No Jira issues assigned.";
    const attention = items.filter((it) => bucketOf(it.status) !== "done");
    const top = attention[0] ?? items[0];
    const attn = attention.length ? `, ${attention.length} need attention` : "";
    const topText = top ? ` Top: ${top.key} — ${top.summary}.` : "";
    return `${items.length} Jira issue${items.length === 1 ? "" : "s"} assigned${attn}.${topText}`;
  },
  Component: Panel,
});

export default jiraMyIssuesWidget;
