import type { CachedResult } from "../../../server/contract";
import type { Indexer } from "../domain/ports";
import type { Pack } from "../domain/release";

const API = "https://api.nibl.co.uk";
const USER_AGENT =
  "cockpit release watch (personal dashboard; polite, one page per poll)";
const TIMEOUT_MS = 20_000;
const BOTS_TTL_MS = 24 * 60 * 60_000;

interface NiblPack {
  botId?: unknown;
  number?: unknown;
  name?: unknown;
  sizekbits?: unknown;
  lastModified?: unknown;
}

type CachedFetch = <T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs?: number,
  force?: boolean,
) => Promise<CachedResult<T>>;

/** "2026-09-09 17:50:18" is server time in UTC. */
function niblDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const d = new Date(value.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * nibl.co.uk: the anime index on Rizon. `lastModified` behaves as first-seen
 * of a (bot, pack, name, size) tuple; `sizekbits` is bytes despite the name.
 */
export class NiblIndexer implements Indexer {
  readonly id = "nibl" as const;

  constructor(private readonly cachedFetch: CachedFetch) {}

  private async bots(): Promise<Record<number, string>> {
    const result = await this.cachedFetch<Record<number, string>>(
      "xdcc:nibl:bots",
      async () => {
        const res = await fetch(`${API}/nibl/bots`, {
          headers: { accept: "application/json", "user-agent": USER_AGENT },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(`nibl bots responded HTTP ${res.status}`);
        const json = (await res.json()) as {
          content?: { id?: number; name?: string }[];
        };
        const map: Record<number, string> = {};
        for (const bot of json.content ?? []) {
          if (typeof bot.id === "number" && typeof bot.name === "string")
            map[bot.id] = bot.name;
        }
        return map;
      },
      BOTS_TTL_MS,
    );
    return result.items ?? {};
  }

  async search(query: string, limit: number): Promise<Pack[]> {
    const url = new URL(`${API}/nibl/search/page`);
    url.searchParams.set("query", query);
    url.searchParams.set("page", "0");
    url.searchParams.set("size", String(Math.min(Math.max(limit, 1), 100)));
    url.searchParams.set("sort", "lastModified");
    url.searchParams.set("direction", "DESC");

    const [res, bots] = await Promise.all([
      fetch(url, {
        headers: { accept: "application/json", "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }),
      this.bots(),
    ]);
    if (!res.ok) throw new Error(`nibl responded HTTP ${res.status}`);
    const json = (await res.json()) as { content?: NiblPack[] };

    const packs: Pack[] = [];
    for (const row of json.content ?? []) {
      if (typeof row.name !== "string" || typeof row.number !== "number")
        continue;
      const botId = typeof row.botId === "number" ? row.botId : null;
      packs.push({
        source: "nibl",
        network: "rizon",
        channel: "#nibl",
        bot: (botId !== null && bots[botId]) || `bot ${botId ?? "?"}`,
        pack: row.number,
        filename: row.name,
        sizeBytes: typeof row.sizekbits === "number" ? row.sizekbits : null,
        gets: null,
        firstSeenAt: niblDate(row.lastModified),
        lastSeenAt: null,
      });
    }
    return packs;
  }
}
