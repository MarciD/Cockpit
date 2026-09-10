import type { Indexer } from "../domain/ports";
import type { Pack } from "../domain/release";

const ENDPOINT = "https://xdcc.info/api/v1/search";
const USER_AGENT =
  "cockpit release watch (personal dashboard; polite, one page per poll)";
const TIMEOUT_MS = 20_000;
/** The API allows 200; one modest page per poll is plenty and kinder. */
const PAGE_MAX = 50;

interface Row {
  pack_num?: unknown;
  filename?: unknown;
  filesize?: unknown;
  gets?: unknown;
  bot?: unknown;
  bot_channel?: unknown;
  network?: unknown;
  last_seen?: unknown;
}

const num = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    typeof value === "string" &&
    value.trim() &&
    Number.isFinite(Number(value))
  ) {
    return Number(value);
  }
  return null;
};

/** "2026-09-10 08:32:11" — server time, read as UTC. */
const seenAt = (value: unknown): Date | null => {
  if (typeof value !== "string") return null;
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * xdcc.info: the broadest index of the three — eight networks including
 * GlobalIRC and CoreIRC, which the others do not carry at all. Its full-text
 * search matches every word (spaces act as wildcards), so the result set is
 * the one a person sees on the site.
 *
 * It reports `last_seen` but no first-indexed timestamp, so a watch's
 * "indexed after I subscribed" rule falls back to our own first sighting for
 * these rows — which the silent first run already establishes.
 *
 * Its `robots.txt` disallows `/search`, the faceted HTML page whose crawling
 * "pins the server"; `/api/v1/*` is the documented public API and is not
 * disallowed. One page per poll, a real User-Agent, no deep pagination.
 */
export class XdccInfoIndexer implements Indexer {
  readonly id = "xdccinfo" as const;

  async search(query: string, limit: number): Promise<Pack[]> {
    const url = new URL(ENDPOINT);
    url.searchParams.set("q", query);
    url.searchParams.set(
      "limit",
      String(Math.min(Math.max(limit, 1), PAGE_MAX)),
    );
    url.searchParams.set("page", "1");
    url.searchParams.set("sort", "last_seen");
    url.searchParams.set("sortDir", "desc");

    const res = await fetch(url, {
      headers: { accept: "application/json", "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`xdcc.info responded HTTP ${res.status}`);
    const json = (await res.json()) as { results?: Row[] };

    const packs: Pack[] = [];
    for (const row of json.results ?? []) {
      if (typeof row.filename !== "string" || typeof row.bot !== "string")
        continue;
      packs.push({
        source: "xdccinfo",
        network: String(row.network ?? "").toLowerCase(),
        channel: typeof row.bot_channel === "string" ? row.bot_channel : null,
        bot: row.bot,
        pack: num(row.pack_num) ?? 0,
        filename: row.filename,
        sizeBytes: num(row.filesize),
        gets: num(row.gets),
        firstSeenAt: null,
        lastSeenAt: seenAt(row.last_seen),
      });
    }
    return packs;
  }
}
