import {
  badRequest,
  json,
  type CachedResult,
  type WidgetRoutes,
} from "../../server/contract";
import type { WeatherReading } from "../types";
import { getWeather } from "./infrastructure/open-meteo";

const HALF_HOUR_MS = 30 * 60_000;

type CachedFetch = <T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs?: number,
  force?: boolean,
) => Promise<CachedResult<T>>;

/** Keyless source, so the cache key is the coordinates and nothing else. */
export function readWeather(
  cachedFetch: CachedFetch,
  latitude: number,
  longitude: number,
  label: string,
  force = false,
) {
  return cachedFetch<WeatherReading>(
    `weather:${latitude},${longitude}`,
    () => getWeather({ latitude, longitude, label }),
    HALF_HOUR_MS,
    force,
  );
}

export function buildRoutes(cachedFetch: CachedFetch): WidgetRoutes {
  return {
    "GET ": async (_req, ctx) => {
      const sp = ctx.url.searchParams;
      const lat = Number(sp.get("lat"));
      const lon = Number(sp.get("lon"));
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return badRequest("lat and lon are required");
      }
      const payload = await readWeather(
        cachedFetch,
        lat,
        lon,
        sp.get("label") ?? "",
        sp.get("refresh") === "1",
      );
      return json({ configured: true, ...payload });
    },
  };
}
