"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, Flex, Stack, Text } from "@chakra-ui/react";
import { getWidget, listWidgets } from "@cockpit/widgets";
import type { WidgetInstance } from "@cockpit/widget-sdk";
import { SignalsProvider } from "@cockpit/widget-sdk/signals";
import { AtelierHeader } from "./atelier-header";
import { GridBoard } from "./grid-board";
import { Modal } from "./modal";
import { WidgetConfigForm } from "./widget-config-form";
import { accentHex } from "@/lib/accent";

interface ProfileViewProps {
  profileId: string;
  name: string;
  kind: string;
  accent: string | null;
  instances: WidgetInstance[];
  initialLayouts: Record<string, unknown>;
}

const JSON_HEADERS = { "content-type": "application/json" };

const CATEGORY_LABELS: Record<string, string> = {
  ai: "Assistant",
  "source-control": "Source control",
  issues: "Issues",
  calendar: "Calendar",
  tasks: "Tasks",
  custom: "Custom",
};
const CATEGORY_ORDER = [
  "ai",
  "source-control",
  "issues",
  "calendar",
  "tasks",
  "custom",
];

export function ProfileView({
  profileId,
  name,
  kind,
  accent,
  instances,
  initialLayouts,
}: ProfileViewProps) {
  const router = useRouter();
  const hue = accentHex(accent);
  // Per-desk accent. We override the *resolved* Chakra colour vars for this
  // subtree (not just `--accent`): Chakra resolves `var(--accent, …)` inside
  // the token definitions at :root, so a descendant `--accent` alone wouldn't
  // re-tint `accent` / `accent.solid` / `accent.tint` / `status.review`.
  const accentVars = {
    "--accent": hue,
    "--chakra-colors-accent": hue,
    "--chakra-colors-accent-solid": `color-mix(in srgb, ${hue} 72%, #3a1e12)`,
    "--chakra-colors-accent-tint": `color-mix(in srgb, ${hue} 14%, transparent)`,
    "--chakra-colors-status-review": hue,
  } as CSSProperties;
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [configuring, setConfiguring] = useState<WidgetInstance | null>(null);

  async function addWidget(widgetId: string) {
    const def = getWidget(widgetId);
    await fetch("/api/widgets", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        profileId,
        widgetId,
        config: def?.defaultConfig ?? {},
      }),
    });
    setPicking(false);
    router.refresh();
  }

  async function saveConfig(
    instanceId: string,
    config: Record<string, unknown>,
  ) {
    await fetch(`/api/widgets/${instanceId}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ config }),
    });
    setConfiguring(null);
    router.refresh();
  }

  async function removeWidget(instanceId: string) {
    await fetch(`/api/widgets/${instanceId}`, { method: "DELETE" });
    router.refresh();
  }

  const configuringDef = configuring
    ? getWidget(configuring.widgetId)
    : undefined;
  const SettingsComponent = configuringDef?.SettingsComponent;

  return (
    // The active desk's hue drives `--accent`, which the `accent` token (and
    // every dot / ring / bar / pill / FAB downstream) resolves against.
    <Stack gap="0" minH="100%" style={accentVars}>
      <SignalsProvider deskId={profileId}>
        <Flex
          direction="column"
          w="100%"
          maxW="1360px"
          mx="auto"
          px={{ base: "4", md: "22px" }}
          py={{ base: "5", md: "22px" }}
          flex="1"
        >
          <AtelierHeader
            name={name}
            kind={kind}
            editing={editing}
            onEditingChange={setEditing}
            onAdd={() => setPicking(true)}
          />

          <Box flex="1">
            {instances.length === 0 ? (
              <Flex
                direction="column"
                align="center"
                justify="center"
                py="20"
                gap="3"
              >
                <Text color="fg.muted">This desk is empty.</Text>
                <Button
                  size="sm"
                  bg="accent"
                  color="accent.fg"
                  borderRadius="small"
                  _hover={{ bg: "accent.solid" }}
                  onClick={() => setPicking(true)}
                >
                  Add your first widget
                </Button>
              </Flex>
            ) : (
              <GridBoard
                profileId={profileId}
                instances={instances}
                initialLayouts={initialLayouts}
                editing={editing}
                onConfigure={(inst) => setConfiguring(inst)}
                onRemove={removeWidget}
              />
            )}
          </Box>
        </Flex>

        {/* Add-widget catalog */}
        <Modal
          open={picking}
          onClose={() => setPicking(false)}
          title="Add a widget"
        >
          <Stack gap="5">
            {CATEGORY_ORDER.map((cat) => {
              const widgets = listWidgets().filter((w) => w.category === cat);
              if (widgets.length === 0) return null;
              return (
                <Stack key={cat} gap="2">
                  <Text textStyle="label">{CATEGORY_LABELS[cat] ?? cat}</Text>
                  {widgets.map((widget) => {
                    const WidgetIcon = widget.icon;
                    return (
                      <Box
                        as="button"
                        key={widget.id}
                        onClick={() => addWidget(widget.id)}
                        textAlign="left"
                        w="100%"
                        display="flex"
                        alignItems="center"
                        gap="3"
                        p="3"
                        borderRadius="small"
                        bg="bg.subtle"
                        cursor="pointer"
                        _hover={{ bg: "bg.muted" }}
                      >
                        <Box color="accent" fontSize="lg" lineHeight="1">
                          <WidgetIcon />
                        </Box>
                        <Box>
                          <Text fontSize="sm" fontWeight="medium">
                            {widget.title}
                          </Text>
                          {widget.description ? (
                            <Text fontSize="xs" color="fg.muted">
                              {widget.description}
                            </Text>
                          ) : null}
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              );
            })}
          </Stack>
        </Modal>

        {/* Per-widget settings */}
        <Modal
          open={Boolean(configuring)}
          onClose={() => setConfiguring(null)}
          title={
            configuringDef ? `Configure — ${configuringDef.title}` : "Configure"
          }
        >
          {configuring && configuringDef ? (
            SettingsComponent ? (
              <SettingsComponent onClose={() => setConfiguring(null)} />
            ) : (
              <WidgetConfigForm
                def={configuringDef}
                config={configuring.config}
                onSave={(config) => saveConfig(configuring.instanceId, config)}
                onCancel={() => setConfiguring(null)}
              />
            )
          ) : null}
        </Modal>
      </SignalsProvider>
    </Stack>
  );
}
