import type { OfferDto, ParsedDto, ReleaseDto, SourceId } from "../../types";
import { releaseKey } from "./release-key";

/** A parsed release name; produced by the parser adapter, consumed here. */
export type Parsed = ParsedDto;

/** One offer as an indexer reports it. `pack` is volatile and never identity. */
export interface Pack {
  source: SourceId;
  network: string;
  channel: string | null;
  bot: string;
  pack: number;
  filename: string;
  sizeBytes: number | null;
  gets: number | null;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
}

export interface Offer extends Pack {
  command: string;
}

export interface Release {
  key: string;
  parsed: Parsed;
  headline: string;
  offers: Offer[];
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
}

export function commandFor(pack: Pack): string {
  return `/msg ${pack.bot} xdcc send #${pack.pack}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "Reacher · S04E06 · 1080p · WEB · German" — what reads like a sentence. */
export function headlineFor(parsed: Parsed): string {
  const parts = [parsed.title];
  if (parsed.seasons.length || parsed.episodes.length) {
    const s = parsed.seasons[0];
    const e = parsed.episodes[0];
    parts.push(
      s !== undefined && e !== undefined
        ? `S${pad(s)}E${pad(e)}`
        : e !== undefined
          ? `E${pad(e)}`
          : `S${pad(s as number)}`,
    );
  } else if (parsed.year) {
    parts.push(parsed.year);
  }
  if (parsed.resolution) parts.push(parsed.resolution);
  if (parsed.quality) parts.push(parsed.quality);
  if (parsed.languages.length) parts.push(languageLabel(parsed));
  return parts.join(" · ");
}

const LANGUAGE_NAMES: Record<string, string> = {
  de: "German",
  en: "English",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  nl: "Dutch",
  pl: "Polish",
  ru: "Russian",
  pt: "Portuguese",
};

function languageLabel(parsed: Parsed): string {
  const names = parsed.languages.map(
    (code) => LANGUAGE_NAMES[code] ?? code.toUpperCase(),
  );
  return parsed.dual ? `${names.join("/")} DL` : names.join("/");
}

function earliest(dates: (Date | null)[]): Date | null {
  const known = dates.filter((d): d is Date => d !== null);
  return known.length
    ? new Date(Math.min(...known.map((d) => d.getTime())))
    : null;
}

function latest(dates: (Date | null)[]): Date | null {
  const known = dates.filter((d): d is Date => d !== null);
  return known.length
    ? new Date(Math.max(...known.map((d) => d.getTime())))
    : null;
}

/** Preferred networks first (in the given order), then by gets, then by bot name. */
export function sortOffers(
  offers: Offer[],
  preferredNetworks: string[],
): Offer[] {
  const rank = (o: Offer) => {
    const i = preferredNetworks.indexOf(o.network.toLowerCase());
    return i === -1 ? preferredNetworks.length : i;
  };
  return [...offers].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (b.gets ?? 0) - (a.gets ?? 0) ||
      a.bot.localeCompare(b.bot),
  );
}

/** Groups offers of the same file (same key) into one release. */
export function groupReleases(
  packs: Pack[],
  parse: (filename: string) => Parsed,
  preferredNetworks: string[],
): Release[] {
  const byKey = new Map<string, { parsed: Parsed; offers: Offer[] }>();
  for (const pack of packs) {
    const key = releaseKey(pack.filename);
    const offer: Offer = { ...pack, command: commandFor(pack) };
    const entry = byKey.get(key);
    if (entry) entry.offers.push(offer);
    else byKey.set(key, { parsed: parse(pack.filename), offers: [offer] });
  }
  return [...byKey.entries()].map(([key, { parsed, offers }]) => ({
    key,
    parsed,
    headline: headlineFor(parsed),
    offers: sortOffers(offers, preferredNetworks),
    firstSeenAt: earliest(offers.map((o) => o.firstSeenAt)),
    lastSeenAt: latest(offers.map((o) => o.lastSeenAt)),
  }));
}

/**
 * Newest first. Not every index reports when it first saw a pack — xdcc.info
 * reports only when it last did — so fall back to that rather than sinking a
 * whole source below the others. Undated releases go last, then by gets.
 */
export function sortReleases(releases: Release[]): Release[] {
  const gets = (r: Release) => r.offers.reduce((n, o) => n + (o.gets ?? 0), 0);
  const seen = (r: Release) =>
    r.firstSeenAt?.getTime() ?? r.lastSeenAt?.getTime() ?? -1;
  return [...releases].sort((a, b) => seen(b) - seen(a) || gets(b) - gets(a));
}

export function toOfferDto(o: Offer): OfferDto {
  return {
    ...o,
    firstSeenAt: o.firstSeenAt?.toISOString() ?? null,
    lastSeenAt: o.lastSeenAt?.toISOString() ?? null,
  };
}

export function toReleaseDto(
  r: Release,
  poster: string | null = null,
): ReleaseDto {
  return {
    key: r.key,
    headline: r.headline,
    parsed: r.parsed,
    offers: r.offers.map(toOfferDto),
    firstSeenAt: r.firstSeenAt?.toISOString() ?? null,
    lastSeenAt: r.lastSeenAt?.toISOString() ?? null,
    poster,
  };
}
