import { Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { defineWidget, type WidgetComponentProps } from "@cockpit/widget-sdk";
import {
  configSchema,
  defaultConfig,
  type WeatherConfig as Config,
} from "./config";
import type { WeatherData as Data } from "./types";

function hourLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit" });
}

function Panel({ data }: WidgetComponentProps<Config, Data>) {
  if (data.error && !data.items) {
    return (
      <Text fontSize="sm" color="danger">
        Weather: {data.error}
      </Text>
    );
  }
  const w = data.items;
  if (!w) {
    return (
      <Text fontSize="sm" color="fg.muted">
        No weather data.
      </Text>
    );
  }
  return (
    <Stack gap="0" h="100%" w="100%">
      <HStack gap="3" align="start" flex="1">
        <Text
          fontWeight="200"
          fontSize="46px"
          lineHeight="1"
          letterSpacing="-0.02em"
        >
          {w.tempC}°
        </Text>
        <Stack gap="0.5" pt="1">
          <Text fontSize="13px" color="fg">
            {w.condition}
          </Text>
          <Text textStyle="data" fontSize="11px" color="fg.muted">
            H {w.highC}° · L {w.lowC}°
          </Text>
        </Stack>
      </HStack>

      {w.hourly.length > 0 ? (
        <Flex
          justify="space-between"
          borderTopWidth="1px"
          borderColor="border"
          pt="2"
          mt="2"
        >
          {w.hourly.map((h) => (
            <Stack key={h.time} gap="0.5" align="center">
              <Text textStyle="data" fontSize="11px" color="fg.muted">
                {h.tempC}°
              </Text>
              <Text textStyle="data" fontSize="9px" color="fg.faint">
                {hourLabel(h.time)}
              </Text>
            </Stack>
          ))}
        </Flex>
      ) : null}
    </Stack>
  );
}

const weatherWidget = defineWidget<Config, Data>({
  id: "weather",
  title: "Weather",
  description: "Current conditions and today's hourly forecast (Open-Meteo).",
  icon: () => <span aria-hidden>☀</span>,
  category: "custom",
  configSchema,
  defaultConfig,
  layout: { defaultW: 3, defaultH: 5, minW: 3, minH: 3 },
  data: {
    queryKey: (config, profileId) => [
      "weather",
      profileId,
      config.latitude,
      config.longitude,
    ],
    queryFn: async (ctx, config) => {
      const res = await fetch(
        `/api/w/weather?lat=${config.latitude}&lon=${config.longitude}&label=${encodeURIComponent(config.label)}${ctx.force ? "&refresh=1" : ""}`,
        { signal: ctx.signal },
      );
      if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})`);
      return (await res.json()) as Data;
    },
    refetchIntervalMs: 30 * 60_000,
    staleTimeMs: 10 * 60_000,
    manualRefresh: true,
  },
  count: (data) => data.items?.label,
  describe: (_config, data) => {
    const w = data.items;
    if (!w) return null;
    return `Weather in ${w.label}: ${w.tempC}°, ${w.condition} (H ${w.highC}° / L ${w.lowC}°).`;
  },
  Component: Panel,
});

export default weatherWidget;
