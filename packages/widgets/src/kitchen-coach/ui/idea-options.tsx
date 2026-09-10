"use client";

import { useState } from "react";
import { Box, Button, Flex, Input, Stack, Text } from "@chakra-ui/react";
import type { Device, IdeaOptions, KitchenProfileDto } from "../types";
import { DEVICE_LABELS } from "../types";
import { Chip } from "./chips";

interface IdeaOptionsSheetProps {
  open: boolean;
  options: IdeaOptions;
  profile: KitchenProfileDto;
  context: string[];
  onChange: (options: IdeaOptions) => void;
  onClose: () => void;
  onReset: () => void;
  onSubmit: (count: number, surprise: boolean) => void;
}

const TIMES = [20, 30, 45, 60];
const CUISINES = [
  "Italienisch",
  "Asiatisch",
  "Levante",
  "Deutsch",
  "Mexikanisch",
  "Französisch",
];
const MOODS = [
  "Comfort",
  "Leicht",
  "Beeindrucken",
  "Schnell & wenig Abwasch",
  "Lernen",
];
const DIETS = [
  "vegetarisch",
  "vegan",
  "low-carb",
  "proteinreich",
  "glutenfrei",
];
const DEVICES: Device[] = ["induktion", "ofen", "airfryer", "mum5"];
const DIFFICULTIES = ["leicht", "mittel", "anspruchsvoll"] as const;

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

/**
 * The advanced layer. Simple stays simple: this is closed by default, and
 * whatever is changed here is remembered for the slot.
 */
export function IdeaOptionsSheet({
  open,
  options,
  profile,
  context,
  onChange,
  onClose,
  onReset,
  onSubmit,
}: IdeaOptionsSheetProps) {
  const [avoidDraft, setAvoidDraft] = useState("");
  if (!open) return null;
  const set = (patch: Partial<IdeaOptions>) =>
    onChange({ ...options, ...patch });

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
        maxW="560px"
        maxH="86dvh"
        overflowY="auto"
        layerStyle="tile"
        borderRadius="dialog"
        boxShadow="dialog"
        p="6"
      >
        <Flex justify="space-between" align="baseline" mb="4">
          <Text textStyle="label" letterSpacing="0.18em">
            optionen · {options.slot}
          </Text>
          <Text textStyle="meta">gemerkt für {options.slot}</Text>
        </Flex>

        <Stack gap="4">
          <Box>
            <Text textStyle="label" mb="1.5">
              zeit
            </Text>
            <Flex gap="2" wrap="wrap" align="center">
              {TIMES.map((t) => (
                <Chip
                  key={t}
                  label={`≤ ${t}`}
                  active={options.totalMinutes === t}
                  onClick={() => set({ totalMinutes: t })}
                />
              ))}
              <Chip
                label="egal"
                active={options.totalMinutes === null}
                onClick={() => set({ totalMinutes: null })}
              />
              <Text textStyle="meta" ml="1">
                aktiv
              </Text>
              {[10, 15, 30].map((t) => (
                <Chip
                  key={t}
                  label={`≤ ${t}`}
                  active={options.activeMinutes === t}
                  onClick={() =>
                    set({
                      activeMinutes: options.activeMinutes === t ? null : t,
                    })
                  }
                />
              ))}
            </Flex>
          </Box>

          <Box>
            <Text textStyle="label" mb="1.5">
              geräte
            </Text>
            <Flex gap="2" wrap="wrap">
              {DEVICES.map((d) => {
                const banned = options.bannedDevices.includes(d);
                const on = options.devices.includes(d);
                return (
                  <Chip
                    key={d}
                    label={DEVICE_LABELS[d]}
                    active={on && !banned}
                    negative={banned}
                    title={
                      banned ? "heute nicht" : on ? "bevorzugt" : "erlaubt"
                    }
                    onClick={() =>
                      set(
                        banned
                          ? {
                              bannedDevices: toggle(options.bannedDevices, d),
                              devices: toggle(options.devices, d),
                            }
                          : on
                            ? {
                                devices: options.devices.filter((x) => x !== d),
                                bannedDevices: [...options.bannedDevices, d],
                              }
                            : { devices: [...options.devices, d] },
                      )
                    }
                  />
                );
              })}
            </Flex>
          </Box>

          <Box>
            <Text textStyle="label" mb="1.5">
              richtung
            </Text>
            <Flex gap="2" wrap="wrap">
              {CUISINES.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  active={options.cuisines.includes(c)}
                  onClick={() => set({ cuisines: toggle(options.cuisines, c) })}
                />
              ))}
            </Flex>
          </Box>

          <Box>
            <Text textStyle="label" mb="1.5">
              stimmung
            </Text>
            <Flex gap="2" wrap="wrap">
              {MOODS.map((m) => (
                <Chip
                  key={m}
                  label={m}
                  active={options.mood === m}
                  onClick={() => set({ mood: options.mood === m ? null : m })}
                />
              ))}
            </Flex>
          </Box>

          <Box>
            <Text textStyle="label" mb="1.5">
              ernährung
            </Text>
            <Flex gap="2" wrap="wrap" align="center">
              {DIETS.map((d) => (
                <Chip
                  key={d}
                  label={d}
                  active={options.diets.includes(d)}
                  onClick={() => set({ diets: toggle(options.diets, d) })}
                />
              ))}
              {profile.allergies.length ? (
                <Text textStyle="meta">
                  profil: keine {profile.allergies.join(", ")}
                </Text>
              ) : null}
            </Flex>
          </Box>

          <Box>
            <Text textStyle="label" mb="1.5">
              nicht verwenden
            </Text>
            <Flex gap="2" wrap="wrap" align="center">
              {options.avoid.map((a) => (
                <Chip
                  key={a}
                  label={a}
                  negative
                  onClick={() =>
                    set({ avoid: options.avoid.filter((x) => x !== a) })
                  }
                />
              ))}
              <Input
                size="sm"
                w="150px"
                placeholder="+ Zutat"
                value={avoidDraft}
                onChange={(e) => setAvoidDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || !avoidDraft.trim()) return;
                  set({ avoid: [...options.avoid, avoidDraft.trim()] });
                  setAvoidDraft("");
                }}
                aria-label="Zutat ausschließen"
              />
            </Flex>
          </Box>

          <Box>
            <Text textStyle="label" mb="1.5">
              mehr
            </Text>
            <Flex gap="2" wrap="wrap" align="center">
              <Chip
                label="nur was da ist"
                active={options.onlyWhatIsThere}
                onClick={() =>
                  set({ onlyWhatIsThere: !options.onlyWhatIsThere })
                }
              />
              <Chip
                label="Reste"
                active={options.leftovers}
                onClick={() => set({ leftovers: !options.leftovers })}
              />
              <Chip
                label="saisonal"
                active={options.seasonal}
                onClick={() => set({ seasonal: !options.seasonal })}
              />
              {[2, 3].map((d) => (
                <Chip
                  key={d}
                  label={`Meal Prep ×${d}`}
                  active={options.mealPrepDays === d}
                  onClick={() =>
                    set({ mealPrepDays: options.mealPrepDays === d ? null : d })
                  }
                />
              ))}
              {DIFFICULTIES.map((d) => (
                <Chip
                  key={d}
                  label={d}
                  active={options.difficulty === d}
                  onClick={() => set({ difficulty: d })}
                />
              ))}
            </Flex>
          </Box>

          <Box>
            <Text textStyle="label" mb="1.5">
              kontext
            </Text>
            <Flex gap="2" wrap="wrap" align="center">
              <Chip
                label="Wetter"
                active={options.useWeather}
                onClick={() => set({ useWeather: !options.useWeather })}
              />
              <Chip
                label="Kalender"
                active={options.useCalendar}
                onClick={() => set({ useCalendar: !options.useCalendar })}
              />
              {context.length ? (
                <Text textStyle="meta">{context.slice(-2).join(" · ")}</Text>
              ) : null}
            </Flex>
          </Box>

          <Box>
            <Text textStyle="label" mb="1.5">
              kochbuch
            </Text>
            <Flex gap="2" wrap="wrap">
              {(
                [
                  ["off", "aus"],
                  ["favourites", "Favoriten einstreuen"],
                  ["not-recent", "nichts aus 14 Tagen"],
                ] as const
              ).map(([value, label]) => (
                <Chip
                  key={value}
                  label={label}
                  active={options.cookbook === value}
                  onClick={() => set({ cookbook: value })}
                />
              ))}
            </Flex>
          </Box>
        </Stack>

        <Flex justify="space-between" align="center" gap="3" mt="5" wrap="wrap">
          <Flex gap="2">
            <Button
              size="sm"
              bg="accent.solid"
              color="accent.fg"
              onClick={() => onSubmit(3, false)}
            >
              3 Ideen holen
            </Button>
            <Button
              size="sm"
              layerStyle="raised"
              color="fg"
              onClick={() => onSubmit(5, false)}
            >
              5 Ideen
            </Button>
          </Flex>
          <Flex gap="3" align="center">
            <Button
              size="sm"
              layerStyle="raised"
              color="fg"
              onClick={() => onSubmit(3, true)}
            >
              Überrasch mich
            </Button>
            <Text
              as="button"
              textStyle="label"
              color="link"
              cursor="pointer"
              onClick={onReset}
            >
              zurücksetzen
            </Text>
          </Flex>
        </Flex>
      </Box>
    </Flex>
  );
}
