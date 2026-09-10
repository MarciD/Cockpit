"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Flex, Input, Link, Stack, Text, chakra } from "@chakra-ui/react";
import { defineWidget, type WidgetComponentProps } from "@cockpit/widget-sdk";
import {
  configSchema,
  defaultConfig,
  defaultOptions,
  defaultProfile,
  slotForTime,
  type KitchenConfig as Config,
} from "./config";
import type {
  CookLogEntryDto,
  IdeaOptions,
  IdeasResponseDto,
  IntentDto,
  KitchenProfileDto,
  MealSlot,
} from "./types";
import { MEAL_SLOTS, SLOT_LABELS } from "./types";
import { Chip } from "./ui/chips";
import { IdeaCard } from "./ui/idea-card";
import { IdeaOptionsSheet } from "./ui/idea-options";
import { API, optionsSummary, postJson } from "./ui/lib";

interface Data {
  profileId: string;
  profile: KitchenProfileDto;
  remembered: Record<string, IdeaOptions>;
  history: CookLogEntryDto[];
}

const QUICK = ["Überrasch mich", "≤ 30 min", "Airfryer", "Reste"] as const;

function pageHref(profileId: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams({ profile: profileId, ...extra });
  return `/w/kitchen-coach?${params.toString()}`;
}

function Panel({
  config,
  data,
  onOpenSettings,
}: WidgetComponentProps<Config, Data>) {
  const isWeekend = [0, 6].includes(new Date().getDay());
  const [slot, setSlot] = useState<MealSlot>(slotForTime(new Date()));
  const [options, setOptions] = useState<IdeaOptions>(() => ({
    ...defaultOptions(slot, data.profile, isWeekend),
    ...(data.remembered[slot] ?? {}),
    slot,
    servings: config.defaultServings || data.profile.servings,
  }));
  const [draft, setDraft] = useState("");
  const [sheet, setSheet] = useState(false);
  const [ideas, setIdeas] = useState<IdeasResponseDto | null>(null);
  // A one-word query could be "cook with it" or "how do I cut it" — offer both.
  const [ambiguous, setAmbiguous] = useState<IntentDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Switching slot loads that slot's remembered options.
  useEffect(() => {
    setOptions((current) => ({
      ...defaultOptions(slot, data.profile, isWeekend),
      ...(data.remembered[slot] ?? {}),
      slot,
      servings: current.servings,
    }));
  }, [slot, data.profile, data.remembered, isWeekend]);

  const last = data.history[0];
  const summary = useMemo(() => optionsSummary(options), [options]);

  const askIntent = useCallback(async (query: string): Promise<IntentDto> => {
    const res = await fetch(`${API}/intent?q=${encodeURIComponent(query)}`);
    return res.ok
      ? ((await res.json()) as IntentDto)
      : { intent: "ideas", technique: null };
  }, []);

  const fetchIdeas = useCallback(
    async (
      count: number,
      surprise: boolean,
      override?: Partial<IdeaOptions>,
    ) => {
      setBusy(true);
      setError(null);
      try {
        const payload = await postJson<IdeasResponseDto>("/ideas", {
          profileId: data.profileId,
          tone: config.tone,
          language: config.language,
          model: config.model,
          images: config.images !== "aus",
          options: { ...options, ...override, count, surprise },
        });
        setIdeas(payload);
      } catch (err) {
        setError(
          (err as Error).message === "needs-connect"
            ? "Erst einen Anthropic-Key verbinden (Assistant-Widget)."
            : "Der Chef ist gerade nicht ansprechbar.",
        );
      } finally {
        setBusy(false);
      }
    },
    [config, data.profileId, options],
  );

  /** Typing a dish cooks; typing a technique opens the card on the page. */
  const submitField = useCallback(async () => {
    const query = draft.trim();
    if (!query) {
      void fetchIdeas(options.count, false);
      return;
    }
    const intent = await askIntent(query);
    setAmbiguous(intent.intent === "ambiguous" ? intent : null);
    if (intent.intent === "technique" && intent.technique) {
      window.location.href = pageHref(data.profileId, {
        technique: intent.technique,
      });
      return;
    }
    const ingredients = [...options.ingredients, query];
    setOptions((o) => ({ ...o, ingredients }));
    setDraft("");
    if (intent.intent === "ambiguous") return; // the chips below offer both
    void fetchIdeas(options.count, false, { ingredients });
  }, [draft, options, askIntent, fetchIdeas, data.profileId]);

  return (
    <Stack gap="2.5" h="100%">
      <Flex justify="space-between" align="center" gap="2">
        <Flex layerStyle="inset" borderRadius="control" p="3px" gap="0">
          {MEAL_SLOTS.filter((s) => s !== "snack").map((s) => (
            <chakra.button
              key={s}
              type="button"
              aria-pressed={slot === s}
              onClick={() => setSlot(s)}
              layerStyle={slot === s ? "raised" : undefined}
              px="10px"
              py="5px"
              borderRadius="18px"
              fontSize="10px"
              fontWeight="medium"
              letterSpacing="0.08em"
              textTransform="uppercase"
              color={slot === s ? "fg" : "fg.muted"}
              cursor="pointer"
            >
              {SLOT_LABELS[s]}
            </chakra.button>
          ))}
        </Flex>
        <Flex
          layerStyle="inset"
          borderRadius="control"
          px="2.5"
          py="1"
          gap="2"
          align="center"
        >
          <chakra.button
            type="button"
            aria-label="Weniger Personen"
            onClick={() =>
              setOptions((o) => ({
                ...o,
                servings: Math.max(1, o.servings - 1),
              }))
            }
            color="fg.muted"
            cursor="pointer"
          >
            −
          </chakra.button>
          <Text textStyle="data" fontSize="13px">
            {options.servings}
          </Text>
          <chakra.button
            type="button"
            aria-label="Mehr Personen"
            onClick={() =>
              setOptions((o) => ({
                ...o,
                servings: Math.min(12, o.servings + 1),
              }))
            }
            color="fg.muted"
            cursor="pointer"
          >
            +
          </chakra.button>
        </Flex>
      </Flex>

      <Flex
        layerStyle="inset"
        borderRadius="control"
        px="3.5"
        py="2"
        gap="2"
        wrap="wrap"
        align="center"
      >
        {options.ingredients.map((item) => (
          <Chip
            key={item}
            label={`${item} ×`}
            onClick={() =>
              setOptions((o) => ({
                ...o,
                ingredients: o.ingredients.filter((i) => i !== item),
              }))
            }
          />
        ))}
        <Input
          variant="subtle"
          bg="transparent"
          border="none"
          px="0"
          h="auto"
          minW="120px"
          flex="1"
          fontSize="12.5px"
          placeholder={
            options.ingredients.length
              ? "…und was noch?"
              : "Was ist da? Oder: Avocado schneiden"
          }
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submitField();
          }}
          _focusVisible={{ outline: "none" }}
          aria-label="Zutaten oder Technik"
        />
      </Flex>

      {ambiguous?.technique ? (
        <Flex gap="1.5" wrap="wrap" align="center">
          <Text textStyle="meta">meintest du</Text>
          <Chip
            label={`Ideen mit ${options.ingredients[options.ingredients.length - 1] ?? ""}`}
            active
            onClick={() => {
              setAmbiguous(null);
              void fetchIdeas(options.count, false);
            }}
          />
          <Chip
            label={`Technik: ${ambiguous.technique}`}
            onClick={() => {
              window.location.href = pageHref(data.profileId, {
                technique: ambiguous.technique as string,
              });
            }}
          />
        </Flex>
      ) : null}

      <Flex gap="1.5" wrap="wrap">
        {QUICK.map((q) => (
          <Chip
            key={q}
            label={q}
            active={
              (q === "≤ 30 min" && options.totalMinutes === 30) ||
              (q === "Airfryer" &&
                options.devices.includes("airfryer") &&
                options.devices.length === 1) ||
              (q === "Reste" && options.leftovers)
            }
            onClick={() => {
              if (q === "Überrasch mich") return void fetchIdeas(3, true);
              if (q === "≤ 30 min")
                return setOptions((o) => ({ ...o, totalMinutes: 30 }));
              if (q === "Airfryer")
                return setOptions((o) => ({ ...o, devices: ["airfryer"] }));
              setOptions((o) => ({ ...o, leftovers: !o.leftovers }));
            }}
          />
        ))}
        <Chip label="Optionen" onClick={() => setSheet(true)} />
      </Flex>

      <Box flex="1" minH="0" overflowY="auto">
        {error ? (
          <Stack gap="2">
            <Text fontSize="sm" color="fg.muted">
              {error}
            </Text>
            {error.includes("Anthropic") ? (
              <chakra.button
                type="button"
                onClick={onOpenSettings}
                textStyle="label"
                color="link"
                cursor="pointer"
                alignSelf="flex-start"
              >
                einstellungen
              </chakra.button>
            ) : null}
          </Stack>
        ) : busy ? (
          <Text fontSize="sm" color="fg.muted">
            Der Chef denkt nach…
          </Text>
        ) : ideas && ideas.ideas.length > 0 ? (
          <Stack gap="2">
            {ideas.ideas.map((idea) => (
              <IdeaCard
                key={idea.title}
                idea={idea}
                onPick={() => {
                  window.location.href = pageHref(data.profileId, {
                    idea: idea.title,
                    slot: options.slot,
                    servings: String(options.servings),
                  });
                }}
              />
            ))}
          </Stack>
        ) : (
          <Stack gap="1.5">
            {summary ? <Text textStyle="meta">{summary}</Text> : null}
            {last ? (
              <Text fontSize="12px" color="fg.muted">
                Zuletzt: {last.title}
                {last.rating ? ` · ${last.rating}/5` : ""}
                {last.notes ? ` · „${last.notes}“` : ""}
              </Text>
            ) : (
              <Text fontSize="12px" color="fg.muted">
                Sag, was da ist — oder frag nach einer Technik.
              </Text>
            )}
          </Stack>
        )}
      </Box>

      <Flex justify="space-between" align="center" gap="2">
        <Link
          href={pageHref(data.profileId)}
          color="link"
          textStyle="label"
          _hover={{ color: "link.hover" }}
        >
          küche öffnen →
        </Link>
        <chakra.button
          type="button"
          onClick={() => void fetchIdeas(options.count, false)}
          textStyle="label"
          color="link"
          cursor="pointer"
          _hover={{ color: "link.hover" }}
        >
          {ideas ? "andere ideen →" : "ideen holen →"}
        </chakra.button>
      </Flex>

      <IdeaOptionsSheet
        open={sheet}
        options={options}
        profile={data.profile}
        context={ideas?.context ?? []}
        onChange={setOptions}
        onClose={() => setSheet(false)}
        onReset={() =>
          setOptions({
            ...defaultOptions(slot, data.profile, isWeekend),
            servings: options.servings,
          })
        }
        onSubmit={(count, surprise) => {
          setSheet(false);
          void fetchIdeas(count, surprise);
        }}
      />
    </Stack>
  );
}

const kitchenCoachWidget = defineWidget<Config, Data>({
  id: "kitchen-coach",
  title: "Küche",
  description: "Dein Küchenchef: Ideen, Rezepte, Techniken — im Ramsay-Ton.",
  icon: () => <span aria-hidden>♨</span>,
  category: "custom",
  configSchema,
  defaultConfig,
  layout: { defaultW: 4, defaultH: 8, minW: 3, minH: 5, mobileH: 9 },
  data: {
    queryKey: (_config, profileId) => ["kitchen-coach", profileId],
    queryFn: async (ctx): Promise<Data> => {
      const res = await fetch(
        `${API}/profile?profileId=${encodeURIComponent(ctx.profileId)}`,
        { signal: ctx.signal },
      );
      if (!res.ok) {
        return {
          profileId: ctx.profileId,
          profile: defaultProfile,
          remembered: {},
          history: [],
        };
      }
      const json = (await res.json()) as {
        profile: KitchenProfileDto;
        options: Record<string, IdeaOptions>;
        history: CookLogEntryDto[];
      };
      return {
        profileId: ctx.profileId,
        profile: json.profile,
        remembered: json.options,
        history: json.history,
      };
    },
    staleTimeMs: 60_000,
    manualRefresh: true,
  },
  count: (data) =>
    data.history[0] ? SLOT_LABELS[slotForTime(new Date())] : undefined,
  describe: (_config, data) => {
    const last = data.history[0];
    if (!last) return "Küche: noch nichts gekocht.";
    return `Küche: zuletzt ${last.title}${last.rating ? ` (${last.rating}/5)` : ""}.`;
  },
  Component: Panel,
});

export default kitchenCoachWidget;
