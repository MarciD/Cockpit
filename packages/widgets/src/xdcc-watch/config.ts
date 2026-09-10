import { z } from "zod";
import type { DefaultsDto, ReleaseFilter, SourceId } from "./types";
import { SOURCE_IDS } from "./types";

/**
 * Widget settings hold the *defaults* every search starts from and every new
 * watch snapshots. Flat on purpose: the generated settings form renders enums
 * as selects, numbers as number inputs, lists as comma-separated strings.
 */
export const configSchema = z.object({
  tileMode: z.enum(["watchlist", "search"]),
  defaultResolution: z.enum(["any", "720p", "1080p", "2160p"]),
  defaultLanguage: z.enum(["any", "German", "English", "dual"]),
  preferredNetworks: z.string(),
  defaultSources: z.string(),
  defaultIntervalHours: z.number(),
  globalExcludes: z.string(),
  defaultMinSizeMb: z.number(),
  defaultMaxSizeGb: z.number(),
  onlyIndexedAfterSubscribe: z.boolean(),
  artwork: z.boolean(),
  showCommands: z.boolean(),
  resultsPerSource: z.number(),
});

export type XdccWatchConfig = z.infer<typeof configSchema>;

export const defaultConfig: XdccWatchConfig = {
  tileMode: "watchlist",
  defaultResolution: "1080p",
  defaultLanguage: "German",
  preferredNetworks: "abjects",
  defaultSources: "xdccinfo, xdccsearch, nibl",
  defaultIntervalHours: 12,
  globalExcludes: "sample, cam, ts, hdts, tc",
  defaultMinSizeMb: 0,
  defaultMaxSizeGb: 0,
  onlyIndexedAfterSubscribe: true,
  artwork: true,
  showCommands: true,
  resultsPerSource: 50,
};

export const MAX_RESULTS_PER_SOURCE = 50;

export function splitList(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function emptyFilter(): ReleaseFilter {
  return {
    match: "all",
    must: [],
    mustNot: [],
    resolutions: [],
    languages: [],
    qualities: [],
    codecs: [],
    groups: [],
    excludeGroups: [],
    minSizeMb: null,
    maxSizeGb: null,
    seenWithinHours: null,
  };
}

/** The filter a fresh search or watch starts from, derived from the settings. */
export function filterFromConfig(config: XdccWatchConfig): ReleaseFilter {
  return {
    ...emptyFilter(),
    mustNot: splitList(config.globalExcludes),
    resolutions:
      config.defaultResolution === "any" ? [] : [config.defaultResolution],
    languages: config.defaultLanguage === "any" ? [] : [config.defaultLanguage],
    minSizeMb: config.defaultMinSizeMb > 0 ? config.defaultMinSizeMb : null,
    maxSizeGb: config.defaultMaxSizeGb > 0 ? config.defaultMaxSizeGb : null,
  };
}

export function sourcesFromConfig(config: XdccWatchConfig): SourceId[] {
  const wanted = splitList(config.defaultSources).map((s) => s.toLowerCase());
  const known = SOURCE_IDS.filter((id) => wanted.includes(id));
  return known.length > 0 ? known : [...SOURCE_IDS];
}

/** Merges stored (possibly partial) config under the defaults and derives the search defaults. */
export function defaultsFromConfig(stored: unknown): DefaultsDto {
  const parsed = configSchema.safeParse({
    ...defaultConfig,
    ...(stored as object),
  });
  const config = parsed.success ? parsed.data : defaultConfig;
  return {
    filter: filterFromConfig(config),
    sources: sourcesFromConfig(config),
    preferredNetworks: splitList(config.preferredNetworks).map((n) =>
      n.toLowerCase(),
    ),
    intervalHours:
      config.defaultIntervalHours > 0 ? config.defaultIntervalHours : 12,
    newness: config.onlyIndexedAfterSubscribe ? "indexed-after" : "unseen",
    artwork: config.artwork,
    showCommands: config.showCommands,
    resultsPerSource: Math.min(
      Math.max(
        1,
        Math.floor(config.resultsPerSource || MAX_RESULTS_PER_SOURCE),
      ),
      MAX_RESULTS_PER_SOURCE,
    ),
  };
}
