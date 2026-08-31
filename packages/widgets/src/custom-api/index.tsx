import { z } from "zod";
import { Stack, Text } from "@chakra-ui/react";
import { defineWidget, type WidgetComponentProps } from "@cockpit/widget-sdk";

/**
 * Config-only, zero-code widget (Homepage-style): point it at a JSON endpoint
 * that returns `{ items: [{ id, label, hint? }] }` and it lists them. Proves the
 * whole pattern — manifest + Zod config + data query + component + states.
 */
// Defaults live in `defaultConfig` (below), not the schema — the schema just
// validates, keeping its input and output types identical to TConfig.
const configSchema = z.object({
  title: z.string(),
  endpoint: z.string(),
});
type Config = z.infer<typeof configSchema>;

interface CustomApiData {
  items: Array<{ id: string; label: string; hint?: string }>;
}

function Panel({ data }: WidgetComponentProps<Config, CustomApiData>) {
  return (
    <Stack gap="1.5">
      {data.items.map((item) => (
        <Text key={item.id} fontSize="sm">
          {item.label}
          {item.hint ? (
            <Text as="span" color="fg.muted">
              {" "}
              · {item.hint}
            </Text>
          ) : null}
        </Text>
      ))}
    </Stack>
  );
}

const customApiWidget = defineWidget<Config, CustomApiData>({
  id: "custom-api",
  title: "Custom API",
  description: "Fetch a JSON endpoint and list its items.",
  icon: () => <span aria-hidden>▦</span>,
  category: "custom",
  configSchema,
  defaultConfig: { title: "Custom API", endpoint: "/api/demo" },
  layout: { defaultW: 3, defaultH: 5, minW: 3, minH: 3, mobileH: 4 },
  data: {
    queryKey: (config, profileId) => ["custom-api", profileId, config.endpoint],
    queryFn: async (ctx, config) => {
      const res = await fetch(config.endpoint, { signal: ctx.signal });
      if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})`);
      return (await res.json()) as CustomApiData;
    },
    refetchIntervalMs: 5 * 60_000,
    staleTimeMs: 60_000,
    // Direct fetch, no server cache — refetch() is already a true re-pull.
    manualRefresh: true,
  },
  Component: Panel,
});

export default customApiWidget;
