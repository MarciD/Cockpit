export interface WeatherConfig {
  latitude: number;
  longitude: number;
  label: string;
}

export interface WeatherData {
  label: string;
  tempC: number;
  code: number;
  condition: string;
  highC: number;
  lowC: number;
  hourly: { time: string; tempC: number }[];
}

// WMO weather-code → short condition label.
const CONDITIONS: [number[], string][] = [
  [[0], "Clear"],
  [[1, 2, 3], "Partly cloudy"],
  [[45, 48], "Fog"],
  [[51, 53, 55, 56, 57], "Drizzle"],
  [[61, 63, 65, 66, 67], "Rain"],
  [[71, 73, 75, 77], "Snow"],
  [[80, 81, 82], "Showers"],
  [[85, 86], "Snow showers"],
  [[95, 96, 99], "Thunderstorm"],
];

function conditionFor(code: number): string {
  for (const [codes, label] of CONDITIONS) {
    if (codes.includes(code)) return label;
  }
  return "—";
}

interface RawForecast {
  current?: { temperature_2m?: number; weather_code?: number };
  daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[] };
  hourly?: { time?: string[]; temperature_2m?: number[] };
}

/** Current conditions + today's hourly forecast from Open-Meteo (keyless). */
export async function getWeather(
  config: WeatherConfig,
  signal?: AbortSignal,
): Promise<WeatherData> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(config.latitude));
  url.searchParams.set("longitude", String(config.longitude));
  url.searchParams.set("current", "temperature_2m,weather_code");
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min");
  url.searchParams.set("hourly", "temperature_2m");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "1");

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Weather request failed (HTTP ${res.status})`);
  const raw = (await res.json()) as RawForecast;

  const code = raw.current?.weather_code ?? 0;
  const times = raw.hourly?.time ?? [];
  const temps = raw.hourly?.temperature_2m ?? [];
  const nowMs = Date.now();
  const found = times.findIndex((t) => new Date(t).getTime() >= nowMs);
  const startIdx = found < 0 ? 0 : found;
  const hourly = times.slice(startIdx, startIdx + 6).map((time, i) => ({
    time,
    tempC: Math.round(temps[startIdx + i] ?? 0),
  }));

  return {
    label: config.label,
    tempC: Math.round(raw.current?.temperature_2m ?? 0),
    code,
    condition: conditionFor(code),
    highC: Math.round(raw.daily?.temperature_2m_max?.[0] ?? 0),
    lowC: Math.round(raw.daily?.temperature_2m_min?.[0] ?? 0),
    hourly,
  };
}
