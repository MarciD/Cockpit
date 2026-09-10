import type { Indexer } from "../domain/ports";
import type { Pack } from "../domain/release";

const ENDPOINT = "https://xdccsearch.com/api/search";
const USER_AGENT =
  "cockpit release watch (personal dashboard; polite, one page per poll)";
const TIMEOUT_MS = 20_000;
/** Larger pages time out on their side. */
const PAGE_MAX = 50;

interface Row {
  filename?: unknown;
  botname?: unknown;
  network?: unknown;
  channel?: unknown;
  slot?: unknown;
  size_bytes?: unknown;
  gets?: unknown;
  timestamp?: unknown;
  seen_time?: unknown;
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v)
    ? v
    : typeof v === "string" && v.trim() && Number.isFinite(Number(v))
      ? Number(v)
      : null;
const unixDate = (v: unknown): Date | null => {
  const n = num(v);
  return n && n > 0 ? new Date(n * 1000) : null;
};

/** xdccsearch.com: JSON, first-indexed and last-seen timestamps, five networks (incl. Abjects). */
export class XdccSearchIndexer implements Indexer {
  readonly id = "xdccsearch" as const;

  async search(query: string, limit: number): Promise<Pack[]> {
    const url = new URL(ENDPOINT);
    url.searchParams.set("query", query);
    url.searchParams.set("page", "1");
    url.searchParams.set(
      "limit",
      String(Math.min(Math.max(limit, 1), PAGE_MAX)),
    );
    url.searchParams.set("sortBy", "seen");
    url.searchParams.set("sortOrder", "desc");

    const res = await fetch(url, {
      headers: { accept: "application/json", "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`xdccsearch responded HTTP ${res.status}`);
    const json = (await res.json()) as { data?: Row[] };
    const rows = Array.isArray(json.data) ? json.data : [];

    const packs: Pack[] = [];
    for (const row of rows) {
      if (typeof row.filename !== "string" || typeof row.botname !== "string")
        continue;
      packs.push({
        source: "xdccsearch",
        network: String(row.network ?? "").toLowerCase(),
        channel: typeof row.channel === "string" ? row.channel : null,
        bot: row.botname,
        pack: num(row.slot) ?? 0,
        filename: row.filename,
        sizeBytes: num(row.size_bytes),
        gets: num(row.gets),
        firstSeenAt: unixDate(row.timestamp),
        lastSeenAt: unixDate(row.seen_time),
      });
    }
    return packs;
  }
}
