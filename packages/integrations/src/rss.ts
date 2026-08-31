import { XMLParser } from "fast-xml-parser";

export interface NewsConfig {
  feeds: string[];
  limit: number;
}

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: string; // ISO, or "" when unknown
}

const MAX_BYTES = 2_000_000;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

// Untrusted third-party XML — access everything defensively through `unknown`.
function get(obj: unknown, key: string): unknown {
  return obj && typeof obj === "object"
    ? (obj as Record<string, unknown>)[key]
    : undefined;
}

function asArray(v: unknown): unknown[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function text(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  const t = get(v, "#text");
  return t === undefined ? "" : String(t);
}

function toIso(raw: string): string {
  if (!raw) return "";
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function atomLink(link: unknown): string {
  const arr = asArray(link);
  const alt = arr.find((l) => get(l, "@_rel") === "alternate");
  const chosen = alt ?? arr[0];
  const href = get(chosen, "@_href");
  if (typeof href === "string") return href;
  return typeof chosen === "string" ? chosen : "";
}

async function parseFeed(
  url: string,
  signal?: AbortSignal,
): Promise<NewsItem[]> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.text()).slice(0, MAX_BYTES);
  const doc: unknown = parser.parse(body);

  // RSS 2.0
  const channel = get(get(doc, "rss"), "channel");
  if (channel) {
    const source = text(get(channel, "title")) || url;
    return asArray(get(channel, "item")).map((it, i) => {
      const link = get(it, "link");
      const linkStr = typeof link === "string" ? link : text(link);
      return {
        id: text(get(it, "guid")) || linkStr || `${url}#${i}`,
        title: text(get(it, "title")),
        link: linkStr,
        source,
        publishedAt: toIso(text(get(it, "pubDate")) || text(get(it, "date"))),
      };
    });
  }

  // Atom
  const feed = get(doc, "feed");
  if (feed) {
    const source = text(get(feed, "title")) || url;
    return asArray(get(feed, "entry")).map((e, i) => ({
      id: text(get(e, "id")) || `${url}#${i}`,
      title: text(get(e, "title")),
      link: atomLink(get(e, "link")),
      source,
      publishedAt: toIso(text(get(e, "updated")) || text(get(e, "published"))),
    }));
  }

  return [];
}

/** Merge several RSS/Atom feeds, newest first, capped at `limit`. */
export async function getNews(
  config: NewsConfig,
  signal?: AbortSignal,
): Promise<NewsItem[]> {
  const results = await Promise.allSettled(
    config.feeds.map((f) => parseFeed(f, signal)),
  );
  const items = results.flatMap((r) =>
    r.status === "fulfilled" ? r.value : [],
  );
  items.sort((a, b) =>
    (b.publishedAt || "").localeCompare(a.publishedAt || ""),
  );
  return items.slice(0, config.limit);
}
