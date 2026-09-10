"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Input,
  Stack,
  Text,
  chakra,
} from "@chakra-ui/react";
import type { RecipeDto } from "../types";
import { Chip } from "./chips";
import { mmss, remaining, type RunningTimer } from "./lib";

interface CookModeProps {
  recipe: RecipeDto;
  onFinish: (rating: number | null, notes: string) => void;
  onClose: () => void;
  speak: (text: string) => void;
  canSpeak: boolean;
}

const TICK_MS = 1000;

/**
 * The page you use with wet hands: one step, big type, timers that survive a
 * reload because they are stored as end timestamps rather than countdowns.
 */
export function CookMode({
  recipe,
  onFinish,
  onClose,
  speak,
  canSpeak,
}: CookModeProps) {
  const [index, setIndex] = useState(0);
  const [timers, setTimers] = useState<RunningTimer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [done, setDone] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);

  const steps = recipe.zubereitung;
  const step = steps[index];

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Keep the screen on; harmless where unsupported.
  useEffect(() => {
    const nav = navigator as Navigator & {
      wakeLock?: {
        request: (type: "screen") => Promise<{ release: () => Promise<void> }>;
      };
    };
    let cancelled = false;
    void nav.wakeLock
      ?.request("screen")
      .then((lock) => {
        if (cancelled) void lock.release();
        else wakeLock.current = lock;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      void wakeLock.current?.release().catch(() => {});
    };
  }, []);

  const startTimer = useCallback(
    (stepIndex: number, minutes: number, label: string) => {
      setTimers((current) => [
        ...current.filter((t) => t.stepIndex !== stepIndex),
        { stepIndex, label, endsAt: Date.now() + minutes * 60_000 },
      ]);
    },
    [],
  );

  // A step with a duration starts its own timer when it opens.
  useEffect(() => {
    if (!step?.durationMin) return;
    startTimer(index, step.durationMin, step.text.slice(0, 24));
  }, [index, step, startTimer]);

  if (done) {
    return (
      <Stack gap="3" maxW="420px" mx="auto" textAlign="center">
        <Text textStyle="label">fertig</Text>
        <Text fontSize="18px" lineHeight="1.3">
          {recipe.title}
        </Text>
        <Flex gap="2" justify="center">
          {[1, 2, 3, 4, 5].map((n) => (
            <Chip
              key={n}
              label={String(n)}
              active={rating === n}
              onClick={() => setRating(n)}
            />
          ))}
        </Flex>
        <Input
          size="sm"
          placeholder="Nächstes Mal…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          aria-label="Notiz"
        />
        <Flex gap="2" justify="center">
          <Button
            size="sm"
            bg="accent.solid"
            color="accent.fg"
            onClick={() => onFinish(rating, notes)}
          >
            Speichern
          </Button>
          <Button size="sm" layerStyle="raised" color="fg" onClick={onClose}>
            Schließen
          </Button>
        </Flex>
      </Stack>
    );
  }

  return (
    <Stack gap="3" maxW="420px" mx="auto">
      <Flex justify="space-between" align="center">
        <Text textStyle="label">
          kochmodus · schritt {index + 1} von {steps.length}
        </Text>
        <chakra.button
          type="button"
          onClick={onClose}
          textStyle="label"
          color="link"
          cursor="pointer"
        >
          schließen
        </chakra.button>
      </Flex>

      <Flex gap="1.5">
        {steps.map((s, i) => (
          <Box
            key={s.text}
            flex="1"
            h="4px"
            borderRadius="2px"
            bg={i <= index ? "accent" : "bg.muted"}
          />
        ))}
      </Flex>

      <Text fontSize="21px" lineHeight="1.32" fontWeight="medium">
        {step?.text ?? "—"}
      </Text>

      <Flex gap="1.5" wrap="wrap">
        {step?.device ? <Chip label={step.device} /> : null}
        {step?.temperatureC ? <Chip label={`${step.temperatureC} °C`} /> : null}
      </Flex>

      {timers.length ? (
        <Box textAlign="center">
          <Text textStyle="data" fontSize="44px" letterSpacing="0.02em">
            {mmss(remaining(timers[timers.length - 1] as RunningTimer, now))}
          </Text>
          <Text textStyle="meta">
            {timers
              .map((t) => `${t.label}: ${mmss(remaining(t, now))}`)
              .join(" · ")}
          </Text>
        </Box>
      ) : null}

      <Flex gap="2" justify="center" wrap="wrap">
        {canSpeak && step ? (
          <Chip label="Vorlesen" onClick={() => speak(step.text)} />
        ) : null}
        {timers.length ? (
          <Chip
            label="Timer +1 min"
            onClick={() =>
              setTimers((current) =>
                current.map((t, i) =>
                  i === current.length - 1
                    ? { ...t, endsAt: t.endsAt + 60_000 }
                    : t,
                ),
              )
            }
          />
        ) : null}
        {step?.durationMin ? (
          <Chip
            label="Timer neu"
            onClick={() =>
              startTimer(
                index,
                step.durationMin as number,
                step.text.slice(0, 24),
              )
            }
          />
        ) : null}
      </Flex>

      <Button
        size="lg"
        bg="accent.solid"
        color="accent.fg"
        borderRadius="control"
        onClick={() =>
          index + 1 < steps.length ? setIndex(index + 1) : setDone(true)
        }
      >
        {index + 1 < steps.length ? "Weiter" : "Fertig"}
      </Button>
    </Stack>
  );
}
