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

/**
 * "Reacher · S04E06 · 1080p · WEB · German DL · x265 · CHIPHEAD" — what reads
 * like a sentence. Codec and group are on it because the same episode in the
 * same resolution and language from two groups is two releases, and the
 * headline is what tells them apart in a list and in a notification.
 */
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
  if (parsed.codec) parts.push(parsed.codec);
  if (parsed.group) parts.push(parsed.group);
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

/** The same bot and pack reach us from more than one index; one line, the fuller dates. */
function mergeOffer(into: Offer, dup: Offer): void {
  into.firstSeenAt = earliest([into.firstSeenAt, dup.firstSeenAt]);
  into.lastSeenAt = latest([into.lastSeenAt, dup.lastSeenAt]);
  into.gets = Math.max(into.gets ?? 0, dup.gets ?? 0) || into.gets;
  into.channel ??= dup.channel;
  into.sizeBytes ??= dup.sizeBytes;
}

/** Groups offers of the same file (same key) into one release. */
export function groupReleases(
  packs: Pack[],
  parse: (filename: string) => Parsed,
  preferredNetworks: string[],
): Release[] {
  const byKey = new Map<
    string,
    { parsed: Parsed; offers: Map<string, Offer> }
  >();
  for (const pack of packs) {
    const key = releaseKey(pack.filename);
    const offer: Offer = { ...pack, command: commandFor(pack) };
    const offerKey = `${pack.network}|${pack.bot.toLowerCase()}|${pack.pack}`;
    const entry = byKey.get(key) ?? {
      parsed: parse(pack.filename),
      offers: new Map<string, Offer>(),
    };
    const known = entry.offers.get(offerKey);
    if (known) mergeOffer(known, offer);
    else entry.offers.set(offerKey, offer);
    byKey.set(key, entry);
  }
  return [...byKey.entries()].map(([key, { parsed, offers: byOffer }]) => {
    const offers = [...byOffer.values()];
    return {
      key,
      parsed,
      headline: headlineFor(parsed),
      offers: sortOffers(offers, preferredNetworks),
      firstSeenAt: earliest(offers.map((o) => o.firstSeenAt)),
      lastSeenAt: latest(offers.map((o) => o.lastSeenAt)),
    };
  });
}

/** Missing numbers sort as given: a season pack (no episode) tops its season, a movie (no season) follows the series. */
function desc(a: number | undefined, b: number | undefined, missing: number) {
  const x = a ?? missing;
  const y = b ?? missing;
  return x === y ? 0 : y - x;
}

const firstWord = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)[0] ?? "";

/**
 * Titles that open with the query's first word come first ("Reacher" before
 * "Jack Reacher" for `reacher`), then by title, then the newest episode first:
 * S04E07, S04E06, …, the S03 pack, S02. Movies follow by year. Same episode,
 * several releases: most fetched first. Timestamps are deliberately not the
 * key — xdcc.info only reports "last seen", which is "now" for every pack on
 * an online bot, so an order by time was an order by which bots were up.
 */
export function sortReleases(releases: Release[], query = ""): Release[] {
  const lead = firstWord(query);
  const leads = (r: Release) =>
    lead && firstWord(r.parsed.title) === lead ? 0 : 1;
  const gets = (r: Release) => r.offers.reduce((n, o) => n + (o.gets ?? 0), 0);
  const year = (r: Release) => (r.parsed.year ? Number(r.parsed.year) : NaN);
  return [...releases].sort(
    (a, b) =>
      leads(a) - leads(b) ||
      a.parsed.title.localeCompare(b.parsed.title, undefined, {
        sensitivity: "base",
      }) ||
      desc(a.parsed.seasons[0], b.parsed.seasons[0], -1) ||
      desc(a.parsed.episodes[0], b.parsed.episodes[0], Infinity) ||
      desc(year(a) || undefined, year(b) || undefined, -1) ||
      gets(b) - gets(a),
  );
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
