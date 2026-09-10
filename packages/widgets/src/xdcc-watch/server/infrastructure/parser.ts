import { parseTorrentTitle } from "@viren070/parse-torrent-title";
import type { Parsed } from "../domain/release";

const EXTENSION = /\.[a-z0-9]{2,4}$/i;
/** "German.DL" / "Dual" — the parser reports the language but not the dual flag. */
const DUAL = /\b(DL|dual)\b/i;

/** The parser handles both scene names and `[Group] Show - 27` anime names. */
export function parseFilename(filename: string): Parsed {
  const r = parseTorrentTitle(filename);
  const title =
    r.title?.trim() ||
    filename.replace(EXTENSION, "").replace(/[._]+/g, " ").trim();
  return {
    title,
    year: r.year ?? null,
    seasons: r.seasons ?? [],
    episodes: r.episodes ?? [],
    resolution: r.resolution ?? null,
    quality: r.quality ?? null,
    codec: r.codec ?? null,
    group: r.group ?? null,
    languages: r.languages ?? [],
    dual: DUAL.test(filename),
  };
}
