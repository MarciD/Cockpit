"use client";

import { useCallback, useMemo, useState } from "react";
import NextLink from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  Flex,
  Input,
  Stack,
  Text,
  chakra,
} from "@chakra-ui/react";
import type { WidgetPageProps } from "../../pages";
import { emptyFilter } from "../config";
import type {
  DefaultsDto,
  NewReleaseDto,
  ReleaseFilter,
  SearchResponseDto,
  SourceId,
  WatchDto,
} from "../types";
import { SOURCE_IDS } from "../types";
import {
  API,
  JSON_HEADERS,
  defaultChips,
  describeWatch,
  formatAge,
  liftChip,
} from "../ui/lib";
import { ReleaseRow } from "../ui/release-row";
import { WatchEditor } from "../ui/watch-editor";

/**
 * The full page: the watch list on the left, search and results on the right.
 * Widget settings are the source of the defaults, so this page reads them from
 * the first search it runs (the server applies them) and shows them as chips.
 */
export function XdccWatchPage({
  profileId,
  params,
  backHref,
}: WidgetPageProps) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [filter, setFilter] = useState<ReleaseFilter | null>(null);
  const [sources, setSources] = useState<SourceId[] | null>(null);
  const [editing, setEditing] = useState<WatchDto | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const focusWatch = params.watch;

  const defaults = useQuery({
    queryKey: ["xdcc-watch", "defaults", profileId],
    queryFn: async () => {
      const res = await fetch(
        `${API}/watches?profileId=${encodeURIComponent(profileId)}`,
      );
      if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})`);
      return (await res.json()) as { watches: WatchDto[] };
    },
  });

  const releases = useQuery({
    queryKey: ["xdcc-watch", "unseen", profileId, focusWatch ?? ""],
    queryFn: async () => {
      const params = new URLSearchParams({ profileId });
      if (focusWatch) params.set("watchId", focusWatch);
      const res = await fetch(`${API}/releases?${params}`);
      if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})`);
      return (await res.json()) as { releases: NewReleaseDto[] };
    },
  });

  const effectiveFilter = filter ?? emptyFilter();
  const results = useQuery({
    queryKey: [
      "xdcc-watch",
      "page-search",
      profileId,
      submitted,
      effectiveFilter,
      sources,
    ],
    enabled: submitted.length > 0,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const search = new URLSearchParams({
        q: submitted,
        filter: JSON.stringify(effectiveFilter),
      });
      if (sources) search.set("sources", sources.join(","));
      const res = await fetch(`${API}/search?${search}`, { signal });
      if (!res.ok) throw new Error(`Search failed (HTTP ${res.status})`);
      return (await res.json()) as SearchResponseDto;
    },
  });

  const watches = defaults.data?.watches ?? [];
  const chips = useMemo(
    () => defaultChips(effectiveFilter, []),
    [effectiveFilter],
  );

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["xdcc-watch"] }),
    [queryClient],
  );

  const watchThis = useCallback(async () => {
    await fetch(`${API}/watches`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        profileId,
        query: submitted,
        filter: effectiveFilter,
        sources: sources ?? SOURCE_IDS,
      }),
    });
    await refresh();
  }, [profileId, submitted, effectiveFilter, sources, refresh]);

  const markSeen = useCallback(async () => {
    await fetch(`${API}/releases/seen`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ profileId, watchId: focusWatch }),
    });
    await refresh();
  }, [profileId, focusWatch, refresh]);

  const runNow = useCallback(
    async (id: string) => {
      await fetch(`${API}/run/${id}`, { method: "POST" });
      await refresh();
    },
    [refresh],
  );

  return (
    <Box
      maxW="1100px"
      mx="auto"
      px={{ base: "4", md: "6" }}
      py={{ base: "4", md: "6" }}
    >
      <Flex justify="space-between" align="baseline" mb="5" gap="4">
        <Box>
          <Text fontSize="22px" fontWeight="medium" letterSpacing="0.02em">
            Release watch
          </Text>
          <Text textStyle="label">
            {watches.length} watch{watches.length === 1 ? "" : "es"} ·{" "}
            {releases.data?.releases.length ?? 0} unseen
          </Text>
        </Box>
        <NextLink href={backHref} style={{ textDecoration: "none" }}>
          <Text textStyle="label" color="link">
            ← dashboard
          </Text>
        </NextLink>
      </Flex>

      <Flex
        gap="4"
        align="flex-start"
        direction={{ base: "column", md: "row" }}
      >
        <Box
          layerStyle="tile"
          p="4"
          w={{ base: "100%", md: "280px" }}
          flexShrink={0}
        >
          <Text textStyle="label" mb="2">
            watching
          </Text>
          {watches.length === 0 ? (
            <Text fontSize="sm" color="fg.muted">
              Nothing yet. Search on the right, then press “Watch this search”.
            </Text>
          ) : (
            watches.map((watch) => (
              <Flex
                key={watch.id}
                py="2"
                gap="2"
                justify="space-between"
                align="center"
                borderBottomWidth="1px"
                borderColor="border"
              >
                <chakra.button
                  type="button"
                  onClick={() => setEditing(watch)}
                  textAlign="left"
                  flex="1"
                  minW="0"
                  cursor="pointer"
                  color="fg"
                >
                  <Text fontSize="sm" lineClamp={1}>
                    {watch.label}
                  </Text>
                  <Text textStyle="meta">{describeWatch(watch)}</Text>
                </chakra.button>
                <Flex gap="2" align="center" flexShrink={0}>
                  {watch.newCount > 0 ? (
                    <Box
                      px="2"
                      borderRadius="pill"
                      bg="accent.solid"
                      color="accent.fg"
                      textStyle="data"
                      fontSize="10px"
                    >
                      {watch.newCount}
                    </Box>
                  ) : null}
                  <chakra.button
                    type="button"
                    onClick={() => void runNow(watch.id)}
                    aria-label={`Check ${watch.label} now`}
                    title="Check now"
                    color="fg.muted"
                    fontSize="13px"
                    cursor="pointer"
                    _hover={{ color: "fg" }}
                  >
                    ⟳
                  </chakra.button>
                </Flex>
              </Flex>
            ))
          )}
          {releases.data && releases.data.releases.length > 0 ? (
            <chakra.button
              type="button"
              onClick={() => void markSeen()}
              textStyle="label"
              color="link"
              cursor="pointer"
              mt="3"
            >
              mark all seen
            </chakra.button>
          ) : null}
        </Box>

        <Box layerStyle="tile" p="4" flex="1" minW="0">
          <chakra.form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(query.trim());
            }}
          >
            <Flex gap="2" align="center" wrap="wrap" mb="3">
              <Flex
                layerStyle="inset"
                borderRadius="control"
                px="3.5"
                py="2"
                flex="1"
                minW="220px"
              >
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
              {SOURCE_IDS.map((id) => {
                const on = (sources ?? SOURCE_IDS).includes(id);
                return (
                  <chakra.button
                    key={id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setSources((current) => {
                        const list = current ?? [...SOURCE_IDS];
                        const next = list.includes(id)
                          ? list.filter((s) => s !== id)
                          : [...list, id];
                        return next.length > 0 ? next : list;
                      })
                    }
                    layerStyle={on ? "raised" : "inset"}
                    px="3"
                    py="1.5"
                    borderRadius="pill"
                    fontSize="12px"
                    color={on ? "fg" : "fg.muted"}
                    cursor="pointer"
                  >
                    {id}
                  </chakra.button>
                );
              })}
            </Flex>
          </chakra.form>

          {submitted ? (
            <Flex
              gap="3"
              wrap="wrap"
              align="center"
              mb="3"
              pb="2"
              borderBottomWidth="1px"
              borderColor="border"
            >
              {chips.map((chip) => (
                <chakra.button
                  key={chip.id}
                  type="button"
                  onClick={() =>
                    setFilter((f) => liftChip(f ?? emptyFilter(), chip.id))
                  }
                  textStyle="meta"
                  color={chip.negative ? "fg.faint" : "accent.solid"}
                  textDecoration={chip.negative ? "line-through" : undefined}
                  cursor="pointer"
                >
                  {chip.label} ×
                </chakra.button>
              ))}
              <chakra.button
                type="button"
                onClick={() => setAdvanced((v) => !v)}
                textStyle="label"
                color="link"
                cursor="pointer"
              >
                {advanced ? "advanced ▾" : "advanced ▸"}
              </chakra.button>
              {results.data ? (
                <Text textStyle="meta" ml="auto">
                  {results.data.releases.length} releases ·{" "}
                  {results.data.hidden} hidden
                </Text>
              ) : null}
            </Flex>
          ) : null}

          {advanced && submitted ? (
            <Stack gap="2" mb="3" p="3" layerStyle="inset" borderRadius="small">
              <Text textStyle="label">advanced</Text>
              <Flex gap="2" wrap="wrap">
                {["720p", "1080p", "2160p"].map((res) => {
                  const on = effectiveFilter.resolutions.includes(res);
                  return (
                    <chakra.button
                      key={res}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setFilter((f) => {
                          const base = f ?? emptyFilter();
                          return {
                            ...base,
                            resolutions: on
                              ? base.resolutions.filter((r) => r !== res)
                              : [...base.resolutions, res],
                          };
                        })
                      }
                      layerStyle={on ? "raised" : undefined}
                      px="3"
                      py="1"
                      borderRadius="pill"
                      fontSize="12px"
                      color={on ? "fg" : "fg.muted"}
                      cursor="pointer"
                    >
                      {res}
                    </chakra.button>
                  );
                })}
                {["German", "English", "dual"].map((lang) => {
                  const on = effectiveFilter.languages.includes(lang);
                  return (
                    <chakra.button
                      key={lang}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setFilter((f) => {
                          const base = f ?? emptyFilter();
                          return {
                            ...base,
                            languages: on
                              ? base.languages.filter((l) => l !== lang)
                              : [...base.languages, lang],
                          };
                        })
                      }
                      layerStyle={on ? "raised" : undefined}
                      px="3"
                      py="1"
                      borderRadius="pill"
                      fontSize="12px"
                      color={on ? "fg" : "fg.muted"}
                      cursor="pointer"
                    >
                      {lang}
                    </chakra.button>
                  );
                })}
              </Flex>
            </Stack>
          ) : null}

          {submitted ? (
            results.isPending ? (
              <Text fontSize="sm" color="fg.muted">
                Searching…
              </Text>
            ) : results.isError ? (
              <Text fontSize="sm" color="danger">
                The search failed. Try again in a moment.
              </Text>
            ) : (
              <>
                {results.data?.releases.map((release) => (
                  <ReleaseRow
                    key={release.key}
                    release={release}
                    showCommands
                  />
                ))}
                {results.data && results.data.releases.length > 0 ? (
                  <Button
                    mt="3"
                    size="sm"
                    bg="accent.solid"
                    color="accent.fg"
                    onClick={() => void watchThis()}
                  >
                    Watch “{submitted}”
                  </Button>
                ) : (
                  <Text fontSize="sm" color="fg.muted">
                    Nothing matched. Lift a default above, or try fewer words.
                  </Text>
                )}
              </>
            )
          ) : releases.data && releases.data.releases.length > 0 ? (
            <>
              <Text textStyle="label" mb="2">
                new since you last looked
              </Text>
              {releases.data.releases.map((row) => (
                <ReleaseRow
                  key={`${row.watchId}-${row.key}`}
                  release={{
                    key: row.key,
                    headline: row.headline,
                    parsed: {
                      title: row.headline,
                      year: null,
                      seasons: [],
                      episodes: [],
                      resolution: null,
                      quality: null,
                      codec: null,
                      group: null,
                      languages: [],
                      dual: false,
                    },
                    offers: row.offers,
                    firstSeenAt: row.firstSeenAt,
                    lastSeenAt: null,
                    poster: null,
                  }}
                  showCommands
                  isNew
                />
              ))}
            </>
          ) : (
            <Text fontSize="sm" color="fg.muted">
              Search for something above. What your watches find shows up here.
            </Text>
          )}
        </Box>
      </Flex>

      <WatchEditor
        watch={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void refresh();
        }}
      />
      <Text textStyle="meta" mt="6">
        Release watch searches public indexes and tells you what is new. It does
        not connect to IRC or transfer anything; the copy button hands you the
        command the index already shows.
      </Text>
    </Box>
  );
}
