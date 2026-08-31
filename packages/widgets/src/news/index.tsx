import { z } from "zod";
import { Link, Stack, Text } from "@chakra-ui/react";
import { defineWidget, type WidgetComponentProps } from "@cockpit/widget-sdk";

const configSchema = z.object({
  feeds: z.string(),
  limit: z.number(),
});
type Config = z.infer<typeof configSchema>;

interface NewsItem {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: string;
}
interface Data {
  configured: boolean;
  items?: NewsItem[];
  error?: string;
}

function relTime(iso: string): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60_000))}M`;
  if (h < 24) return `${h}H`;
  return `${Math.floor(h / 24)}D`;
}

function splitFeeds(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function Panel({ data }: WidgetComponentProps<Config, Data>) {
  if (data.error && !data.items) {
    return (
      <Text fontSize="sm" color="danger">
        News: {data.error}
      </Text>
    );
  }
  const items = data.items ?? [];
  if (items.length === 0) {
    return (
      <Text fontSize="sm" color="fg.muted">
        No headlines.
      </Text>
    );
  }
  return (
    <Stack gap="0" w="100%">
      {items.map((it, i) => (
        <Stack
          key={it.id}
          gap="0.5"
          py="2.5"
          borderTopWidth={i === 0 ? "0" : "1px"}
          borderColor="border"
        >
          <Link
            href={it.link}
            target="_blank"
            rel="noreferrer"
            display="block"
            w="full"
            textAlign="left"
            whiteSpace="nowrap"
            overflow="hidden"
            textOverflow="ellipsis"
            fontSize="13px"
            color="fg"
          >
            {it.title}
          </Link>
          <Text textStyle="meta" textTransform="uppercase">
            {it.source}
            {it.publishedAt ? ` · ${relTime(it.publishedAt)}` : ""}
          </Text>
        </Stack>
      ))}
    </Stack>
  );
}

const newsWidget = defineWidget<Config, Data>({
  id: "news",
  title: "News",
  description: "Headlines from your RSS/Atom feeds.",
  icon: () => <span aria-hidden>❋</span>,
  category: "custom",
  configSchema,
  defaultConfig: { feeds: "https://hnrss.org/frontpage", limit: 8 },
  layout: { defaultW: 3, defaultH: 5, minW: 3, minH: 3, mobileH: 6 },
  data: {
    queryKey: (config, profileId) => [
      "news",
      profileId,
      config.feeds,
      config.limit,
    ],
    queryFn: async (ctx, config) => {
      const feeds = splitFeeds(config.feeds);
      const qs = feeds.map((f) => `feed=${encodeURIComponent(f)}`).join("&");
      const res = await fetch(
        `/api/news?${qs}&limit=${config.limit}${ctx.force ? "&refresh=1" : ""}`,
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
  Component: Panel,
});

export default newsWidget;
