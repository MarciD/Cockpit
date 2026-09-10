"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Input,
  Stack,
  Text,
  chakra,
} from "@chakra-ui/react";
import type { NotifyMode, WatchDto } from "../types";
import { API, JSON_HEADERS, describeWatch } from "./lib";

interface WatchEditorProps {
  watch: WatchDto | null;
  onClose: () => void;
  onSaved: () => void;
}

const INTERVALS = [6, 12, 24];
const NOTIFY: { value: NotifyMode; label: string }[] = [
  { value: "default", label: "default" },
  { value: "inbox", label: "inbox" },
  { value: "phone", label: "+ phone" },
  { value: "urgent", label: "urgent" },
];

/**
 * Simple by default: label, query, interval, notify, and one line saying which
 * filters this watch inherited. Everything else is behind “advanced”.
 */
export function WatchEditor({ watch, onClose, onSaved }: WatchEditorProps) {
  const [label, setLabel] = useState("");
  const [intervalHours, setIntervalHours] = useState(12);
  const [notifyMode, setNotifyMode] = useState<NotifyMode>("default");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!watch) return;
    setLabel(watch.label);
    setIntervalHours(watch.intervalHours);
    setNotifyMode(watch.notifyMode);
  }, [watch]);

  if (!watch) return null;

  async function patch(body: Record<string, unknown>) {
    if (!watch) return;
    setBusy(true);
    await fetch(`${API}/watches/${watch.id}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    });
    setBusy(false);
    onSaved();
  }

  async function remove() {
    if (!watch) return;
    setBusy(true);
    await fetch(`${API}/watches/${watch.id}`, { method: "DELETE" });
    setBusy(false);
    onSaved();
  }

  return (
    <Flex
      position="fixed"
      inset="0"
      zIndex={50}
      align="center"
      justify="center"
      p="4"
      bg="rgba(60,45,30,0.3)"
      backdropFilter="blur(3px)"
      onClick={onClose}
    >
      <Box
        onClick={(e) => e.stopPropagation()}
        w="100%"
        maxW="460px"
        maxH="82dvh"
        overflowY="auto"
        layerStyle="tile"
        borderRadius="dialog"
        boxShadow="dialog"
        p="6"
      >
        <Flex justify="space-between" align="baseline" mb="4">
          <Text textStyle="label" letterSpacing="0.18em">
            watch · {watch.query}
          </Text>
          <Text textStyle="meta">
            {watch.lastRunAt
              ? `last run ${new Date(watch.lastRunAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "not run yet"}
          </Text>
        </Flex>

        <Stack gap="3">
          <Box>
            <Text textStyle="label" mb="1">
              label
            </Text>
            <Input
              size="sm"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              aria-label="Watch label"
            />
          </Box>

          <Box>
            <Text textStyle="label" mb="1">
              interval
            </Text>
            <Flex gap="2">
              {INTERVALS.map((hours) => (
                <chakra.button
                  key={hours}
                  type="button"
                  aria-pressed={intervalHours === hours}
                  onClick={() => setIntervalHours(hours)}
                  layerStyle={intervalHours === hours ? "raised" : "inset"}
                  px="3"
                  py="1.5"
                  borderRadius="pill"
                  fontSize="12px"
                  color={intervalHours === hours ? "fg" : "fg.muted"}
                  cursor="pointer"
                >
                  {hours} h
                </chakra.button>
              ))}
            </Flex>
          </Box>

          <Box>
            <Text textStyle="label" mb="1">
              notify
            </Text>
            <Flex gap="2" wrap="wrap">
              {NOTIFY.map((mode) => (
                <chakra.button
                  key={mode.value}
                  type="button"
                  aria-pressed={notifyMode === mode.value}
                  onClick={() => setNotifyMode(mode.value)}
                  layerStyle={notifyMode === mode.value ? "raised" : "inset"}
                  px="3"
                  py="1.5"
                  borderRadius="pill"
                  fontSize="12px"
                  color={notifyMode === mode.value ? "fg" : "fg.muted"}
                  cursor="pointer"
                >
                  {mode.label}
                </chakra.button>
              ))}
            </Flex>
          </Box>

          <Box>
            <Text textStyle="label" mb="1">
              filters
            </Text>
            <Text textStyle="meta">
              {describeWatch(watch)} · from your defaults
            </Text>
          </Box>
        </Stack>

        <Flex justify="space-between" align="center" mt="5" gap="3">
          <Flex gap="2">
            <Button
              size="sm"
              bg="accent.solid"
              color="accent.fg"
              loading={busy}
              onClick={() => void patch({ label, intervalHours, notifyMode })}
            >
              Save
            </Button>
            <Button
              size="sm"
              layerStyle="raised"
              color="fg"
              onClick={() =>
                void patch({ active: !watch.active || Boolean(watch.pausedAt) })
              }
            >
              {watch.pausedAt || !watch.active ? "Resume" : "Pause"}
            </Button>
          </Flex>
          <chakra.button
            type="button"
            onClick={() => void remove()}
            textStyle="label"
            color="danger"
            cursor="pointer"
          >
            delete
          </chakra.button>
        </Flex>
      </Box>
    </Flex>
  );
}
