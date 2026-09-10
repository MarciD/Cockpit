import type { MatchMode, ReleaseFilter } from "../../types";
import type { Release } from "./release";

const MB = 1024 * 1024;
const GB = 1024 * MB;
const HOUR_MS = 60 * 60 * 1000;

/** Language labels the UI offers → parser ISO codes. "dual" is a flag, not a code. */
const LANGUAGE_CODES: Record<string, string[]> = {
  german: ["de"],
  english: ["en"],
  french: ["fr"],
  spanish: ["es"],
  italian: ["it"],
  japanese: ["ja"],
  korean: ["ko"],
  multi: ["multi"],
};

const CODEC_FAMILIES: Record<string, string[]> = {
  x264: ["x264", "h264", "avc"],
  h264: ["x264", "h264", "avc"],
  x265: ["x265", "h265", "hevc"],
  hevc: ["x265", "h265", "hevc"],
  av1: ["av1"],
};

const STRING_LIST_KEYS = [
  "must",
  "mustNot",
  "resolutions",
  "languages",
  "qualities",
  "codecs",
  "groups",
  "excludeGroups",
] as const;

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter(Boolean)
        .slice(0, 50),
    ),
  );
}

function cleanNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

/** Accepts anything a client sends and returns a well-formed filter. */
export function normalizeFilter(value: unknown): ReleaseFilter {
  const v = (value && typeof value === "object" ? value : {}) as Record<
    string,
    unknown
  >;
  const match: MatchMode =
    v.match === "phrase" || v.match === "regex" ? v.match : "all";
  const lists = Object.fromEntries(
    STRING_LIST_KEYS.map((k) => [k, cleanList(v[k])]),
  ) as Pick<ReleaseFilter, (typeof STRING_LIST_KEYS)[number]>;
  return {
    match,
    ...lists,
    minSizeMb: cleanNumber(v.minSizeMb),
    maxSizeGb: cleanNumber(v.maxSizeGb),
    seenWithinHours: cleanNumber(v.seenWithinHours),
  };
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * The query, re-checked locally so every source means the same thing —
 * indexers differ wildly, one matching every word and another any of them.
 *
 * A word matches a filename token it *starts*, not any substring: searching
 * "reacher" must not return "…a Treacherous Swallow", while "s04" still finds
 * "S04E06". A phrase is explicit, so it stays a plain substring match.
 */
export function matchesQuery(
  filename: string,
  query: string,
  mode: MatchMode,
): boolean {
  const q = query.trim();
  if (!q) return true;
  if (mode === "regex") {
    try {
      return new RegExp(q, "i").test(filename);
    } catch {
      return false;
    }
  }
  const tokens = words(filename);
  if (mode === "phrase") return tokens.join(" ").includes(words(q).join(" "));
  return words(q).every((w) => tokens.some((t) => t.startsWith(w)));
}

function containsToken(filename: string, token: string): boolean {
  const t = words(token).join(" ");
  return t.length > 0 && words(filename).join(" ").includes(t);
}

function languageOk(release: Release, wanted: string[]): boolean {
  if (wanted.length === 0) return true;
  const { languages, dual } = release.parsed;
  return wanted.some((label) => {
    const key = label.toLowerCase();
    if (key === "dual") return dual;
    const codes = LANGUAGE_CODES[key] ?? [key];
    if (codes.includes("en") && languages.length === 0 && !dual) return true; // untagged scene = English
    return codes.some((c) => languages.includes(c));
  });
}

function codecOk(codec: string | null, wanted: string[]): boolean {
  if (wanted.length === 0) return true;
  if (!codec) return false;
  const have = codec.toLowerCase();
  return wanted.some((w) =>
    (CODEC_FAMILIES[w.toLowerCase()] ?? [w.toLowerCase()]).includes(have),
  );
}

function qualityOk(quality: string | null, wanted: string[]): boolean {
  if (wanted.length === 0) return true;
  if (!quality) return false;
  const have = quality.toLowerCase().replace(/[^a-z0-9]/g, "");
  return wanted.some((w) =>
    have.startsWith(w.toLowerCase().replace(/[^a-z0-9]/g, "")),
  );
}

/** Every rule the filter model knows, applied to one grouped release. */
export function passesFilter(
  release: Release,
  filter: ReleaseFilter,
  now: Date,
): boolean {
  const { parsed, offers } = release;
  const anyFile = offers[0]?.filename ?? "";

  if (filter.must.some((t) => !containsToken(anyFile, t))) return false;
  if (filter.mustNot.some((t) => containsToken(anyFile, t))) return false;

  if (filter.resolutions.length) {
    const res = parsed.resolution?.toLowerCase() ?? "";
    if (!filter.resolutions.some((r) => r.toLowerCase() === res)) return false;
  }
  if (!languageOk(release, filter.languages)) return false;
  if (!qualityOk(parsed.quality, filter.qualities)) return false;
  if (!codecOk(parsed.codec, filter.codecs)) return false;

  const group = parsed.group?.toLowerCase() ?? "";
  if (
    filter.groups.length &&
    !filter.groups.some((g) => g.toLowerCase() === group)
  )
    return false;
  if (filter.excludeGroups.some((g) => g.toLowerCase() === group && group))
    return false;

  const size = offers.find((o) => o.sizeBytes !== null)?.sizeBytes ?? null;
  if (size !== null) {
    if (filter.minSizeMb !== null && size < filter.minSizeMb * MB) return false;
    if (filter.maxSizeGb !== null && size > filter.maxSizeGb * GB) return false;
  }

  if (filter.seenWithinHours !== null) {
    const last = release.lastSeenAt?.getTime();
    if (
      last !== undefined &&
      now.getTime() - last > filter.seenWithinHours * HOUR_MS
    )
      return false;
  }
  return true;
}
