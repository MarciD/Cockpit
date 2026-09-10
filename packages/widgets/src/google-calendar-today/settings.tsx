"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  HStack,
  Input,
  Stack,
  Text,
  chakra,
} from "@chakra-ui/react";

interface CalMeta {
  id: string;
  label: string;
  color: string;
  source: string;
}

type Source = "google" | "outlook" | "ical";
const SOURCES: [Source, string][] = [
  ["google", "Google"],
  ["outlook", "Outlook"],
  ["ical", "iCal"],
];

/** Manage the connected calendars (add / remove). iCal URLs stay server-side. */
export function CalendarSettings({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [calendars, setCalendars] = useState<CalMeta[]>([]);
  const [label, setLabel] = useState("");
  const [source, setSource] = useState<Source>("google");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/w/google-calendar-today/calendars");
    if (res.ok) {
      const j = (await res.json()) as { calendars?: CalMeta[] };
      setCalendars(j.calendars ?? []);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refetchWidgets() {
    qc.invalidateQueries({ queryKey: ["calendar"] });
    qc.invalidateQueries({ queryKey: ["calendar-view"] });
  }

  async function add() {
    if (!label.trim() || !url.trim() || busy) return;
    setBusy(true);
    await fetch("/api/w/google-calendar-today/calendars", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: label.trim(), source, url: url.trim() }),
    });
    setLabel("");
    setUrl("");
    await load();
    refetchWidgets();
    setBusy(false);
  }

  async function remove(id: string) {
    await fetch(`/api/w/google-calendar-today/calendars/${id}`, {
      method: "DELETE",
    });
    await load();
    refetchWidgets();
  }

  return (
    <Stack gap="4">
      <Text textStyle="label">Calendars</Text>
      {calendars.length === 0 ? (
        <Text fontSize="sm" color="fg.muted">
          No calendars yet — add one below.
        </Text>
      ) : (
        <Stack gap="2">
          {calendars.map((c) => (
            <HStack key={c.id} gap="3">
              <Box
                boxSize="10px"
                borderRadius="full"
                bg={c.color}
                flexShrink={0}
              />
              <Stack gap="0" flex="1" minW="0">
                <Text fontSize="sm" color="fg" lineClamp={1}>
                  {c.label}
                </Text>
                <Text textStyle="meta">{c.source} · url saved</Text>
              </Stack>
              <chakra.button
                type="button"
                onClick={() => remove(c.id)}
                fontSize="xs"
                color="danger"
                cursor="pointer"
                _hover={{ textDecoration: "underline" }}
              >
                Remove
              </chakra.button>
            </HStack>
          ))}
        </Stack>
      )}

      <Stack gap="2" pt="1">
        <Text textStyle="label">Add a calendar</Text>
        <Input
          size="sm"
          placeholder="Label (e.g. Work)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <chakra.select
          value={source}
          onChange={(e) => setSource(e.target.value as Source)}
          borderWidth="1px"
          borderColor="border.strong"
          borderRadius="small"
          bg="bg.panel"
          color="fg"
          px="2"
          py="1.5"
          fontSize="sm"
        >
          {SOURCES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </chakra.select>
        <Input
          size="sm"
          type="password"
          placeholder="Secret iCal URL (…/basic.ics)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Text fontSize="xs" color="fg.faint">
          Google / Outlook: Settings → Integrate calendar → “Secret address in
          iCal format”. Stored securely on the server — never sent to the
          browser.
        </Text>
      </Stack>

      <HStack justify="flex-end" gap="2" pt="1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          borderColor="border.strong"
          color="fg.muted"
          onClick={onClose}
        >
          Close
        </Button>
        <Button
          type="button"
          size="sm"
          bg="accent"
          color="accent.fg"
          _hover={{ bg: "accent.solid" }}
          disabled={!label.trim() || !url.trim() || busy}
          onClick={add}
        >
          Add
        </Button>
      </HStack>
    </Stack>
  );
}
