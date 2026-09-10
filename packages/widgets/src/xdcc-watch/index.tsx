"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Flex, Input, Link, Stack, Text, chakra } from "@chakra-ui/react";
import { defineWidget, type WidgetComponentProps } from "@cockpit/widget-sdk";
import {
  configSchema,
  defaultConfig,
  defaultsFromConfig,
  type XdccWatchConfig,
} from "./config";
import type { DefaultsDto, SearchResponseDto, WatchDto } from "./types";
import {
  API,
  JSON_HEADERS,
  defaultChips,
  describeWatch,
  formatAge,
  liftChip,
} from "./ui/lib";
import { ReleaseRow } from "./ui/release-row";

interface Data {
  profileId: string;
  defaults: DefaultsDto;
  watches: WatchDto[];
  newTotal: number;
}

function pageHref(profileId: string, watchId?: string): string {
  const params = new URLSearchParams({ profile: profileId });
  if (watchId) params.set("watch", watchId);
  return `/w/xdcc-watch?${params.toString()}`;
}

function Panel({ config, data }: WidgetComponentProps<XdccWatchConfig, Data>) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [filter, setFilter] = useState(data.defaults.filter);
  const chips = useMemo(
    () => defaultChips(filter, data.defaults.preferredNetworks),
    [filter, data.defaults.preferredNetworks],
  );

  const results = useQuery({
    queryKey: ["xdcc-watch", "search", data.profileId, submitted, filter],
    enabled: submitted.length > 0,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({
        q: submitted,
        filter: JSON.stringify(filter),
        sources: data.defaults.sources.join(","),
        networks: data.defaults.preferredNetworks.join(","),
        limit: String(data.defaults.resultsPerSource),
        artwork: data.defaults.artwork ? "1" : "0",
      });
      const res = await fetch(`${API}/search?${params}`, { signal });
      if (!res.ok) throw new Error(`Search failed (HTTP ${res.status})`);
      return (await res.json()) as SearchResponseDto;
    },
  });

  const watchThis = useCallback(async () => {
    await fetch(`${API}/watches`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        profileId: data.profileId,
        query: submitted,
        filter,
        sources: data.defaults.sources,
        preferredNetworks: data.defaults.preferredNetworks,
        intervalHours: data.defaults.intervalHours,
        newness: data.defaults.newness,
      }),
    });
    await queryClient.invalidateQueries({
      queryKey: ["xdcc-watch", data.profileId],
    });
  }, [data.profileId, data.defaults, submitted, filter, queryClient]);

  const searching = submitted.length > 0;

  return (
    <Stack gap="3" h="100%">
      <chakra.form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(query.trim());
        }}
      >
        <Flex
          layerStyle="inset"
          borderRadius="control"
          px="3.5"
          py="2"
          align="center"
          gap="2"
        >
          <Box color="fg.faint" aria-hidden>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </Box>
          <Input
            variant="subtle"
            bg="transparent"
            border="none"
            px="0"
            h="auto"
            fontSize="sm"
            placeholder="Search packs…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            _focusVisible={{ outline: "none" }}
            aria-label="Search packs"
          />
        </Flex>
      </chakra.form>

      {searching ? (
        <Flex gap="2" wrap="wrap" align="center">
          {chips.map((chip) => (
            <chakra.button
              key={chip.id}
              type="button"
              onClick={() => setFilter((f) => liftChip(f, chip.id))}
              textStyle="meta"
              color={chip.negative ? "fg.faint" : "accent.solid"}
              textDecoration={chip.negative ? "line-through" : undefined}
              cursor="pointer"
              title="Lift this default for this search"
            >
              {chip.label} ×
            </chakra.button>
          ))}
          {results.data && results.data.hidden > 0 ? (
            <Text textStyle="meta">{results.data.hidden} hidden</Text>
          ) : null}
        </Flex>
      ) : null}

      <Box flex="1" minH="0" overflowY="auto">
        {searching ? (
          results.isPending ? (
            <Text fontSize="sm" color="fg.muted">
              Searching…
            </Text>
          ) : results.isError ? (
            <Text fontSize="sm" color="danger">
              The search failed. Try again in a moment.
            </Text>
          ) : results.data && results.data.releases.length > 0 ? (
            results.data.releases
              .slice(0, 8)
              .map((release) => (
                <ReleaseRow
                  key={release.key}
                  release={release}
                  showCommands={data.defaults.showCommands}
                />
              ))
          ) : (
            <Text fontSize="sm" color="fg.muted">
              Nothing matched. Lift a default above, or try fewer words.
            </Text>
          )
        ) : data.watches.length === 0 ? (
          <Text fontSize="sm" color="fg.muted">
            Nothing watched yet. Search for something, then keep an eye on it.
          </Text>
        ) : (
          data.watches.map((watch) => (
            <Flex
              key={watch.id}
              justify="space-between"
              align="center"
              gap="2"
              py="2"
              borderBottomWidth="1px"
              borderColor="border"
            >
              <Box minW="0">
                <Text fontSize="sm" lineClamp={1}>
                  {watch.label}
                </Text>
                <Text textStyle="meta">
                  {describeWatch(watch)} ·{" "}
                  {watch.lastRunAt ? formatAge(watch.lastRunAt) : "not run yet"}
                </Text>
              </Box>
              {watch.newCount > 0 ? (
                <Box
                  px="2"
                  borderRadius="pill"
                  bg="accent.solid"
                  color="accent.fg"
                  textStyle="data"
                  fontSize="10px"
                  flexShrink={0}
                >
                  {watch.newCount} new
                </Box>
              ) : null}
            </Flex>
          ))
        )}
      </Box>

      <Flex justify="space-between" align="center" gap="2">
        <Link
          href={pageHref(data.profileId)}
          color="link"
          textStyle="label"
          _hover={{ color: "link.hover" }}
        >
          open release watch →
        </Link>
        {searching && results.data && results.data.releases.length > 0 ? (
          <chakra.button
            type="button"
            onClick={() => void watchThis()}
            textStyle="label"
            color="link"
            cursor="pointer"
            _hover={{ color: "link.hover" }}
          >
            watch this search →
          </chakra.button>
        ) : null}
      </Flex>
    </Stack>
  );
}

const xdccWatchWidget = defineWidget<XdccWatchConfig, Data>({
  id: "xdcc-watch",
  title: "Release watch",
  description:
    "Search public XDCC indexes and get told when something new shows up.",
  icon: () => <span aria-hidden>◎</span>,
  category: "custom",
  configSchema,
  defaultConfig,
  layout: { defaultW: 4, defaultH: 6, minW: 3, minH: 4, mobileH: 6 },
  data: {
    queryKey: (_config, profileId) => ["xdcc-watch", profileId],
    queryFn: async (ctx, config): Promise<Data> => {
      const defaults = defaultsFromConfig(config);
      const res = await fetch(
        `${API}/watches?profileId=${encodeURIComponent(ctx.profileId)}`,
        { signal: ctx.signal },
      );
      const watches = res.ok
        ? ((await res.json()) as { watches: WatchDto[] }).watches
        : [];
      return {
        profileId: ctx.profileId,
        defaults,
        watches,
        newTotal: watches.reduce((n, w) => n + w.newCount, 0),
      };
    },
    refetchIntervalMs: 5 * 60_000,
    staleTimeMs: 60_000,
    manualRefresh: true,
  },
  count: (data) => (data.newTotal > 0 ? `${data.newTotal} new` : undefined),
  describe: (_config, data) => {
    if (data.watches.length === 0) return "Release watch: nothing watched yet.";
    return `Release watch: ${data.newTotal} new pack(s) across ${data.watches.length} watch(es).`;
  },
  Component: Panel,
});

export default xdccWatchWidget;
