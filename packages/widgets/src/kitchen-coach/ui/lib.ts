"use client";

import type { IdeaOptions } from "../types";

export const API = "/api/w/kitchen-coach";
export const JSON_HEADERS = { "content-type": "application/json" };

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (json as { error?: string }).error === "needs-connect"
        ? "needs-connect"
        : ((json as { error?: string }).error ?? `HTTP ${res.status}`),
    );
  }
  return json as T;
}

export function minutesLabel(total: number, active: number): string {
  return active && active < total
    ? `${total} min · ${active} aktiv`
    : `${total} min`;
}

export function clockLabel(date: Date): string {
  return date.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Chips summarising what differs from the profile, for the tile's one line. */
export function optionsSummary(options: IdeaOptions): string {
  const parts: string[] = [];
  if (options.totalMinutes) parts.push(`≤ ${options.totalMinutes} min`);
  if (options.devices.length && options.devices.length < 4) {
    parts.push(options.devices.join(", "));
  }
  if (options.cuisines.length) parts.push(options.cuisines.join("/"));
  if (options.mood) parts.push(options.mood);
  if (options.leftovers) parts.push("Reste");
  if (options.mealPrepDays) parts.push(`Meal Prep ×${options.mealPrepDays}`);
  return parts.join(" · ");
}

/** A cook-mode timer, resolved from its start so a reload does not lose it. */
export interface RunningTimer {
  stepIndex: number;
  label: string;
  endsAt: number;
}

export function remaining(timer: RunningTimer, now: number): number {
  return Math.max(0, Math.round((timer.endsAt - now) / 1000));
}

export function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
