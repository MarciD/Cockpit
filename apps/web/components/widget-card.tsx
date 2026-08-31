"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, HStack, Stack, Text, chakra } from "@chakra-ui/react";
import type { WidgetDefinition, WidgetInstance } from "@cockpit/widget-sdk";
import { useEmitSignal, useSignalStore } from "@cockpit/widget-sdk/signals";

interface WidgetCardProps {
  def: WidgetDefinition;
  instance: WidgetInstance;
  editing?: boolean;
  onConfigure?: (instance: WidgetInstance) => void;
  onRemove?: (instanceId: string) => void;
}

/**
 * Host wrapper around a widget: runs its data query and renders the shared
 * loading / error / success states as a neumorphic tile. In EDIT mode the
 * header exposes a grip (drag handle), configure and remove controls.
 */
export function WidgetCard({
  def,
  instance,
  editing,
  onConfigure,
  onRemove,
}: WidgetCardProps) {
  const config = {
    ...(def.defaultConfig as Record<string, unknown>),
    ...(instance.config as Record<string, unknown>),
  };
  const Component = def.Component;

  // A manual sync sets this ref; the queryFn reads-and-resets it so only that
  // one fetch is forced (interval/mount refetches stay unforced).
  const forceRef = useRef(false);
  const manualRefresh = def.data.manualRefresh ?? !!def.connection;

  const query = useQuery({
    queryKey: def.data.queryKey(config, instance.profileId),
    queryFn: ({ signal }) => {
      const force = forceRef.current;
      forceRef.current = false;
      return def.data.queryFn(
        { profileId: instance.profileId, signal, force },
        config,
      );
    },
    refetchInterval: def.data.refetchIntervalMs,
    staleTime: def.data.staleTimeMs,
  });

  const handleSync = useCallback(() => {
    if (query.isFetching) return;
    forceRef.current = true;
    void query.refetch();
  }, [query]);

  const count =
    !editing && query.isSuccess && def.count
      ? def.count(query.data)
      : undefined;

  // Auto-publish this widget's data as a `widget:context` signal so the AI
  // assistant widget gets desk context. Keyed on the summary text so it only
  // re-emits when the summary actually changes.
  const emit = useEmitSignal();
  const store = useSignalStore();
  const described =
    query.isSuccess && def.describe ? def.describe(config, query.data) : null;
  const summary =
    described == null
      ? null
      : typeof described === "string"
        ? described
        : described.summary;
  const summaryTitle =
    described && typeof described !== "string" ? described.title : undefined;
  useEffect(() => {
    if (summary == null) return;
    emit({
      type: "widget:context",
      source: instance.instanceId,
      widgetId: def.id,
      payload: { title: summaryTitle ?? def.title, summary },
      at: Date.now(),
    });
  }, [summary, summaryTitle, instance.instanceId, def.id, def.title, emit]);
  useEffect(
    () => () => store.remove(instance.instanceId, "widget:context"),
    [store, instance.instanceId],
  );

  return (
    <Box
      layerStyle="tile"
      p="13px 15px"
      h="100%"
      display="flex"
      flexDirection="column"
      overflow="hidden"
      outline={editing ? "1.5px dashed" : undefined}
      outlineColor={editing ? "accent" : undefined}
      outlineOffset="-2px"
      transition="box-shadow 0.2s ease"
      _hover={{ boxShadow: "panelHover" }}
      css={{
        "&:hover .wgear, &:focus-within .wgear": { opacity: 1 },
        "&:hover .wsync, &:focus-within .wsync": { opacity: 1 },
        "@keyframes wsync-spin": { to: { transform: "rotate(360deg)" } },
      }}
    >
      <HStack justify="space-between" gap="2" mb="3" flexShrink={0}>
        <HStack gap="2" minW="0">
          <Box boxSize="6px" borderRadius="full" bg="accent" flexShrink={0} />
          <Text textStyle="label" lineClamp={1}>
            {def.title}
          </Text>
        </HStack>

        <HStack gap="2" flexShrink={0}>
          {!editing && count !== undefined && count !== "" ? (
            <Text textStyle="data" fontSize="10px" color="fg.muted">
              {count}
            </Text>
          ) : null}
          {manualRefresh && !editing ? (
            <chakra.button
              className="wsync"
              type="button"
              aria-label="Sync now"
              title={
                query.dataUpdatedAt
                  ? `Updated ${new Date(query.dataUpdatedAt).toLocaleTimeString(
                      [],
                      { hour: "2-digit", minute: "2-digit" },
                    )} · click to sync`
                  : "Sync now"
              }
              onClick={handleSync}
              disabled={query.isFetching}
              opacity={0}
              transition="opacity 0.15s ease, color 0.15s ease"
              color="fg.muted"
              fontSize="13px"
              lineHeight="1"
              cursor={query.isFetching ? "progress" : "pointer"}
              flexShrink={0}
              _hover={{ color: "fg" }}
              _focusVisible={{ opacity: 1 }}
              css={
                query.isFetching
                  ? {
                      animation: "wsync-spin 0.8s linear infinite",
                      display: "inline-block",
                    }
                  : undefined
              }
            >
              ⟳
            </chakra.button>
          ) : null}
          {editing ? (
            <>
              <Box
                className="wgrip"
                role="button"
                aria-label="Drag to reorder"
                title="Drag to reorder"
                w="16px"
                h="16px"
                flexShrink={0}
                cursor="grab"
                bgImage="radial-gradient(circle, #b9b6ac 1.1px, transparent 1.3px)"
                bgSize="5px 5px"
              />
              <chakra.button
                type="button"
                aria-label="Remove widget"
                onClick={() => onRemove?.(instance.instanceId)}
                bg="accent.solid"
                color="accent.fg"
                boxSize="18px"
                borderRadius="full"
                fontSize="12px"
                lineHeight="1"
                cursor="pointer"
                display="flex"
                alignItems="center"
                justifyContent="center"
                flexShrink={0}
              >
                ×
              </chakra.button>
            </>
          ) : null}
          <chakra.button
            className="wgear"
            type="button"
            aria-label="Widget settings"
            onClick={() => onConfigure?.(instance)}
            opacity={editing ? 1 : 0}
            transition="opacity 0.15s ease, color 0.15s ease"
            color="fg.muted"
            fontSize="13px"
            lineHeight="1"
            cursor="pointer"
            flexShrink={0}
            _hover={{ color: "fg" }}
            _focusVisible={{ opacity: 1 }}
          >
            ⚙
          </chakra.button>
        </HStack>
      </HStack>

      <Box
        flex="1"
        minH="0"
        overflow="hidden"
        display="flex"
        flexDirection="column"
        color="fg"
        fontSize="sm"
        // Query container so widgets can reflow to their own tile width via
        // `@container widget (...)` — inline-size contains only the horizontal
        // axis, so the flex-derived height is unaffected (visual no-op today).
        css={{ containerType: "inline-size", containerName: "widget" }}
      >
        {query.isPending ? (
          <Stack gap="2.5">
            <Box h="3.5" bg="bg.muted" borderRadius="full" />
            <Box h="3.5" w="82%" bg="bg.muted" borderRadius="full" />
            <Box h="3.5" w="64%" bg="bg.muted" borderRadius="full" />
          </Stack>
        ) : query.isError ? (
          <Stack gap="3" align="start">
            <Text fontSize="sm" color="danger">
              Couldn’t load. {(query.error as Error).message}
            </Text>
            <chakra.button
              type="button"
              onClick={() => query.refetch()}
              borderWidth="1px"
              borderColor="border.strong"
              borderRadius="small"
              color="fg.muted"
              fontSize="xs"
              px="3"
              py="1.5"
              cursor="pointer"
              _hover={{ bg: "bg.subtle" }}
            >
              Retry
            </chakra.button>
          </Stack>
        ) : (
          <Component
            config={config}
            data={query.data}
            onOpenSettings={() => onConfigure?.(instance)}
          />
        )}
      </Box>
    </Box>
  );
}
