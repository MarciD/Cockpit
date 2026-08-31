import { isCategory, type Category } from "../domain/category";
import type { NewItem } from "../domain/vocabulary-item";

/**
 * CSV in/out. The delimiter is auto-detected per file (comma or semicolon) — the
 * ChatGPT project exports `;`-delimited with a richer header, while generic/older
 * files use `,`. Columns are matched by header (case-insensitive) with a
 * positional fallback, so `category,term,translation,notes`,
 * `category,spanish,german,notes`, and `type;topic;spanish;german;notes;…` all
 * import correctly.
 */

/** Sniff the delimiter from the first line: whichever of ; or , occurs more. */
function detectDelimiter(text: string): "," | ";" {
  const firstLine = text.slice(
    0,
    text.indexOf("\n") >= 0 ? text.indexOf("\n") : text.length,
  );
  const semis = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return semis > commas ? ";" : ",";
}

/** RFC-4180-ish parser: handles quoted fields, escaped quotes, CRLF, ; or ,. */
function parseRows(text: string, delimiter: "," | ";"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully blank lines.
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

// Map common source labels onto our category set (e.g. the ChatGPT export uses
// "verb", we model verbs as "verb_infinitive").
const CATEGORY_ALIASES: Record<string, Category> = {
  verb: "verb_infinitive",
  verbo: "verb_infinitive",
  time_phrase: "time_phrase",
  time: "time_word",
  adjective: "common_word",
  adverb: "common_word",
  word: "common_word",
};

function normalizeCategory(raw: string): Category {
  const v = raw.trim().toLowerCase();
  if (isCategory(v)) return v;
  return CATEGORY_ALIASES[v] ?? "common_word";
}

export interface ParseOptions {
  /** Header names (case-insensitive) that identify the target-language column. */
  termHeaders: string[];
  /** Header names that identify the native-language column. */
  translationHeaders: string[];
}

export function parseVocabCsv(csv: string, opts: ParseOptions): NewItem[] {
  const rows = parseRows(csv, detectDelimiter(csv));
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const findCol = (candidates: string[], fallback: number): number => {
    for (const c of candidates) {
      const idx = header.indexOf(c.trim().toLowerCase());
      if (idx >= 0) return idx;
    }
    return fallback;
  };

  const catCol = findCol(["category", "type"], 0);
  const termCol = findCol(opts.termHeaders, 1);
  const transCol = findCol(opts.translationHeaders, 2);
  const notesCol = findCol(["notes", "note"], 3);

  const looksLikeHeader =
    header.includes("category") ||
    header.includes("term") ||
    opts.termHeaders.some((h) => header.includes(h.trim().toLowerCase()));
  const dataRows = looksLikeHeader ? rows.slice(1) : rows;

  const items: NewItem[] = [];
  for (const r of dataRows) {
    const term = (r[termCol] ?? "").trim();
    const translation = (r[transCol] ?? "").trim();
    if (!term || !translation) continue;
    items.push({
      category: normalizeCategory(r[catCol] ?? ""),
      term,
      translation,
      notes: (r[notesCol] ?? "").trim() || null,
    });
  }
  return items;
}

export interface SerializeOptions {
  termHeader: string;
  translationHeader: string;
}

export function serializeVocabCsv(
  items: Array<{
    category: string;
    term: string;
    translation: string;
    notes: string | null;
  }>,
  opts: SerializeOptions,
): string {
  const esc = (s: string): string =>
    /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  const lines = [
    ["category", opts.termHeader, opts.translationHeader, "notes"]
      .map(esc)
      .join(","),
  ];
  for (const it of items) {
    lines.push(
      [it.category, it.term, it.translation, it.notes ?? ""]
        .map((v) => esc(String(v)))
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}
