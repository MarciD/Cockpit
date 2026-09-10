"use client";

import { Box, Flex, Image, Stack, Text, chakra } from "@chakra-ui/react";
import type { RecipeDto } from "../types";
import { Chip } from "./chips";
import { clockLabel } from "./lib";

interface RecipeViewProps {
  recipe: RecipeDto;
  scheduleFrom: Date | null;
  onServings: (servings: number) => void;
  onVariation: (label: string) => void;
  onDevice: (device: string) => void;
  busy?: boolean;
}

const DEVICE_SWAPS = ["Airfryer", "Ofen", "Pfanne"];

/** Your six sections, in order, on one screen. */
export function RecipeView({
  recipe,
  scheduleFrom,
  onServings,
  onVariation,
  onDevice,
  busy,
}: RecipeViewProps) {
  const start = scheduleFrom
    ? new Date(
        scheduleFrom.getTime() -
          recipe.zubereitung.reduce((m, s) => m + (s.durationMin ?? 3), 0) *
            60_000,
      )
    : null;

  return (
    <Stack gap="4">
      <Flex justify="space-between" align="flex-start" gap="4" wrap="wrap">
        <Flex gap="3" align="flex-start" flex="1" minW="240px">
          {recipe.image ? (
            <Image
              src={recipe.image}
              alt=""
              w="84px"
              h="84px"
              borderRadius="9px"
              objectFit="cover"
              boxShadow="raisedSm"
              flexShrink={0}
            />
          ) : null}
          <Box minW="0">
            <Text textStyle="label">
              rezept · {recipe.servings}{" "}
              {recipe.servings === 1 ? "person" : "personen"}
            </Text>
            <Text fontSize="21px" fontWeight="medium" lineHeight="1.25" mt="1">
              {recipe.title}
            </Text>
            {recipe.image ? (
              <Text textStyle="meta" mt="1">
                Symbolbild · Pexels
              </Text>
            ) : null}
          </Box>
        </Flex>
        <Flex
          layerStyle="inset"
          borderRadius="control"
          px="3"
          py="1.5"
          gap="3"
          align="center"
        >
          <chakra.button
            type="button"
            aria-label="Weniger Personen"
            onClick={() => onServings(Math.max(1, recipe.servings - 1))}
            color="fg.muted"
            cursor="pointer"
          >
            −
          </chakra.button>
          <Text textStyle="data">{recipe.servings}</Text>
          <chakra.button
            type="button"
            aria-label="Mehr Personen"
            onClick={() => onServings(Math.min(12, recipe.servings + 1))}
            color="fg.muted"
            cursor="pointer"
          >
            +
          </chakra.button>
        </Flex>
      </Flex>

      <Flex
        gap="2"
        wrap="wrap"
        align="center"
        pb="3"
        borderBottomWidth="1px"
        borderColor="border"
      >
        {DEVICE_SWAPS.map((d) => (
          <Chip
            key={d}
            label={d}
            onClick={() => onDevice(d)}
            title="Gerät wechseln"
          />
        ))}
        {recipe.variationen.map((v) => (
          <Chip
            key={v.label}
            label={v.label}
            onClick={() => onVariation(v.label)}
          />
        ))}
        {start ? (
          <Text textStyle="meta" ml="auto">
            Essen um {clockLabel(scheduleFrom as Date)} · Start{" "}
            {clockLabel(start)}
          </Text>
        ) : null}
        {busy ? (
          <Text textStyle="meta" color="fg.muted">
            der Chef schreibt um…
          </Text>
        ) : null}
      </Flex>

      <Flex gap="2" wrap="wrap">
        {[
          ["geschmack", recipe.einordnung.geschmack],
          ["textur", recipe.einordnung.textur],
          ["schwierigkeit", recipe.einordnung.schwierigkeit],
          ["zeit", recipe.einordnung.zeit],
        ].map(([label, value]) => (
          <Box
            key={label}
            layerStyle="inset"
            borderRadius="small"
            px="3"
            py="2"
            flex="1"
            minW="140px"
          >
            <Text textStyle="label">{label}</Text>
            <Text fontSize="13px">{value}</Text>
          </Box>
        ))}
      </Flex>

      <Flex
        gap="6"
        align="flex-start"
        direction={{ base: "column", md: "row" }}
      >
        <Box flex="1" minW="0">
          <Text textStyle="label" mb="1.5">
            zutaten
          </Text>
          {recipe.zutaten.map((z) => (
            <Flex
              key={`${z.amount}-${z.item}`}
              gap="3"
              py="1.5"
              borderBottomWidth="1px"
              borderColor="border"
            >
              <Text
                textStyle="data"
                fontSize="12px"
                w="72px"
                textAlign="right"
                flexShrink={0}
              >
                {z.amount}
              </Text>
              <Box minW="0">
                <Text fontSize="13px">{z.item}</Text>
                {z.alternative ? (
                  <Text fontSize="11.5px" color="fg.muted">
                    alt.: {z.alternative}
                  </Text>
                ) : null}
              </Box>
            </Flex>
          ))}

          {recipe.vorbereitung.length ? (
            <>
              <Text textStyle="label" mt="4" mb="1.5">
                vorbereitung
              </Text>
              {recipe.vorbereitung.map((v) => (
                <Flex
                  key={v}
                  gap="3"
                  py="1.5"
                  borderBottomWidth="1px"
                  borderColor="border"
                >
                  <Text textStyle="meta" w="14px" flexShrink={0}>
                    ·
                  </Text>
                  <Text fontSize="13px">{v}</Text>
                </Flex>
              ))}
            </>
          ) : null}
        </Box>

        <Box flex="1.4" minW="0">
          <Text textStyle="label" mb="1.5">
            zubereitung
          </Text>
          {recipe.zubereitung.map((step, i) => (
            <Flex
              key={step.text}
              gap="3"
              py="2"
              borderBottomWidth="1px"
              borderColor="border"
            >
              <Text
                textStyle="data"
                fontSize="12px"
                color="fg.muted"
                w="16px"
                flexShrink={0}
              >
                {i + 1}
              </Text>
              <Box minW="0">
                <Text fontSize="13px" lineHeight="1.45">
                  {step.text}
                </Text>
                <Flex gap="1.5" mt="1" wrap="wrap">
                  {step.device ? <Chip label={step.device} /> : null}
                  {step.temperatureC ? (
                    <Chip label={`${step.temperatureC} °C`} />
                  ) : null}
                  {step.durationMin ? (
                    <Chip label={`${step.durationMin} min`} />
                  ) : null}
                  {step.leadTimeHours ? (
                    <Chip label={`${step.leadTimeHours} h vorher`} />
                  ) : null}
                </Flex>
              </Box>
            </Flex>
          ))}

          <Box
            mt="4"
            px="3.5"
            py="3"
            borderLeftWidth="3px"
            borderColor="accent"
            bg="accent.tint"
            borderRightRadius="9px"
          >
            <Text textStyle="label" color="accent.solid" mb="1">
              chef-kommentar
            </Text>
            <Text fontSize="13px" lineHeight="1.45">
              {recipe.chefKommentar.intro}
            </Text>
            {recipe.chefKommentar.fehler.length ? (
              <Box mt="2">
                <Text textStyle="meta">typische fehler</Text>
                {recipe.chefKommentar.fehler.map((f) => (
                  <Text key={f} fontSize="12.5px" lineHeight="1.4">
                    · {f}
                  </Text>
                ))}
              </Box>
            ) : null}
            {recipe.chefKommentar.worauf.length ? (
              <Box mt="2">
                <Text textStyle="meta">worauf es ankommt</Text>
                {recipe.chefKommentar.worauf.map((w) => (
                  <Text key={w} fontSize="12.5px" lineHeight="1.4">
                    · {w}
                  </Text>
                ))}
              </Box>
            ) : null}
          </Box>
        </Box>
      </Flex>
    </Stack>
  );
}
