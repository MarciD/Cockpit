import { z } from "zod";

/** Coordinates and the label the header badge and the assistant use. */
export const configSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  label: z.string(),
});

export type WeatherConfig = z.infer<typeof configSchema>;

export const defaultConfig: WeatherConfig = {
  latitude: 52.52,
  longitude: 13.405,
  label: "Berlin",
};
