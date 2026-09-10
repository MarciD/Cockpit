"use client";

import type { OfferDto, ReleaseFilter, WatchDto } from "../types";

export const JSON_HEADERS = { "content-type": "application/json" };
export const API = "/api/w/xdcc-watch";

export function formatSize(bytes: number | null): string {
  if (bytes === null) return "—";
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)}G`;
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))}M`;
}

/** "2 h", "3 d", "just now" — the age wording the news widget uses. */
export function formatAge(iso: string | null): string {
  if (!iso) return "—";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.round(hours / 24)} d`;
}

/** The one-line summary a watch row shows: what makes it differ from the defaults. */
export function describeWatch(watch: WatchDto): string {
  const parts: string[] = [`${watch.intervalHours} h`];
  if (watch.seriesMode) {
    parts.push(
      watch.seriesFrom
        ? `series from S${String(watch.seriesFrom.season).padStart(2, "0")}E${String(watch.seriesFrom.episode).padStart(2, "0")}`
        : "series",
    );
  }
  if (watch.filter.resolutions.length)
    parts.push(watch.filter.resolutions.join("/"));
  if (watch.filter.languages.length)
    parts.push(watch.filter.languages.join("/"));
  else parts.push("any language");
  if (watch.notifyMode === "phone" || watch.notifyMode === "urgent")
    parts.push("phone");
  if (watch.pausedAt) parts.push("paused");
  else if (watch.snoozedUntil && new Date(watch.snoozedUntil) > new Date())
    parts.push("snoozed");
  return parts.join(" · ");
}

/** Chips for the defaults line under the search field; tapping one lifts it. */
export interface DefaultChip {
  id: string;
  label: string;
  negative?: boolean;
}

export function defaultChips(
  filter: ReleaseFilter,
  networks: string[],
): DefaultChip[] {
  const chips: DefaultChip[] = [];
  for (const r of filter.resolutions) chips.push({ id: `res:${r}`, label: r });
  for (const l of filter.languages) chips.push({ id: `lang:${l}`, label: l });
  if (networks.length) chips.push({ id: "net", label: `${networks[0]} first` });
  if (filter.mustNot.length) {
    chips.push({
      id: "exclude",
      label: filter.mustNot.slice(0, 3).join(" · "),
      negative: true,
    });
  }
  return chips;
}

export function liftChip(filter: ReleaseFilter, id: string): ReleaseFilter {
  const [kind, value] = id.split(":");
  if (kind === "res")
    return {
      ...filter,
      resolutions: filter.resolutions.filter((r) => r !== value),
    };
  if (kind === "lang")
    return {
      ...filter,
      languages: filter.languages.filter((l) => l !== value),
    };
  if (kind === "exclude") return { ...filter, mustNot: [] };
  return filter;
}

export async function copyCommand(offer: OfferDto): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(offer.command);
    return true;
  } catch {
    return false;
  }
}
