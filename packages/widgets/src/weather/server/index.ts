import "server-only";
import {
  describePayload,
  type WidgetServerFactory,
} from "../../server/contract";
import { buildRoutes, readWeather } from "./routes";

const BERLIN = { lat: 52.52, lon: 13.405, label: "Berlin" };

/** Open-Meteo, no key. The assistant may ask for any place, not just this desk's. */
export const weatherServer: WidgetServerFactory = (deps) => ({
  id: "weather",
  routes: buildRoutes(deps.cachedFetch),
  assistantTools: [
    {
      name: "get_weather",
      description:
        "Current weather and today's forecast. Defaults to Berlin; pass lat/lon (and a label) for anywhere else.",
      inputSchema: {
        type: "object",
        properties: {
          lat: { type: "number", description: "Latitude in decimal degrees" },
          lon: { type: "number", description: "Longitude in decimal degrees" },
          label: { type: "string", description: "Place name for the answer" },
        },
        additionalProperties: false,
      },
      run: async (input) => {
        const lat = typeof input.lat === "number" ? input.lat : BERLIN.lat;
        const lon = typeof input.lon === "number" ? input.lon : BERLIN.lon;
        const label =
          typeof input.label === "string" ? input.label : BERLIN.label;
        const payload = await readWeather(deps.cachedFetch, lat, lon, label);
        return describePayload("Weather", { configured: true, ...payload });
      },
    },
  ],
});
