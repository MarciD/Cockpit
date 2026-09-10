/** DTOs shared by the tile and the server route. */
export interface WeatherReading {
  label: string;
  tempC: number;
  code: number;
  condition: string;
  highC: number;
  lowC: number;
  hourly: { time: string; tempC: number }[];
}

export interface WeatherData {
  configured: boolean;
  items?: WeatherReading;
  error?: string;
}
