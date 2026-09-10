"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  Flex,
  Input,
  Stack,
  Text,
  chakra,
} from "@chakra-ui/react";
import type { WidgetPageProps } from "../../pages";
import { useSpeech } from "../../lib/use-speech";
import { defaultOptions, defaultProfile, slotForTime } from "../config";
import type {
  CookLogEntryDto,
  IdeaOptions,
  KitchenProfileDto,
  MealSlot,
  RecipeDto,
  RecipeSummaryDto,
  TechniqueDto,
} from "../types";
import { MEAL_SLOTS, SLOT_LABELS } from "../types";
import { ChefChat } from "../ui/chef-chat";
import { Chip } from "../ui/chips";
import { CookMode } from "../ui/cook-mode";
import { API, postJson } from "../ui/lib";
import { RecipeView } from "../ui/recipe-view";
import { TechniqueCard } from "../ui/technique-card";

const TABS = ["Heute", "Kochbuch", "Techniken", "Profil"] as const;
type Tab = (typeof TABS)[number];

interface ProfilePayload {
  profile: KitchenProfileDto;
  options: Record<string, IdeaOptions>;
  history: CookLogEntryDto[];
}

/** `/w/kitchen-coach?profile=<desk>[&idea=…][&technique=…][&recipe=<id>]` */
export function KitchenCoachPage({
  profileId,
  params,
  backHref,
}: WidgetPageProps) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>(params.technique ? "Techniken" : "Heute");
  const [recipe, setRecipe] = useState<RecipeDto | null>(null);
  const [technique, setTechnique] = useState<TechniqueDto | null>(null);
  const [techniqueQuery, setTechniqueQuery] = useState(params.technique ?? "");
  const [mealTime, setMealTime] = useState<Date | null>(null);
  const [cooking, setCooking] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // German recipes; the hook maps the name to a BCP-47 tag.
  const speech = useSpeech("German");

  const profileQuery = useQuery({
    queryKey: ["kitchen-coach", "profile", profileId],
    queryFn: async () => {
      const res = await fetch(
        `${API}/profile?profileId=${encodeURIComponent(profileId)}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as ProfilePayload;
    },
  });
  const cookbook = useQuery({
    queryKey: ["kitchen-coach", "recipes", profileId],
    queryFn: async () => {
      const res = await fetch(
        `${API}/recipes?profileId=${encodeURIComponent(profileId)}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as { recipes: RecipeSummaryDto[] };
    },
  });

  const profile = profileQuery.data?.profile ?? defaultProfile;
  const slot = (params.slot as MealSlot) ?? slotForTime(new Date());
  const options = useMemo<IdeaOptions>(
    () => ({
      ...defaultOptions(slot, profile, [0, 6].includes(new Date().getDay())),
      ...(profileQuery.data?.options[slot] ?? {}),
      slot,
      servings: Number(params.servings) || profile.servings,
    }),
    [slot, profile, profileQuery.data, params.servings],
  );

  const fail = (err: unknown) =>
    setError(
      (err as Error).message === "needs-connect"
        ? "Erst einen Anthropic-Key verbinden (Assistant-Widget)."
        : "Der Chef ist gerade nicht ansprechbar.",
    );

  const write = useCallback(
    async (title: string) => {
      setBusy("recipe");
      setError(null);
      try {
        setRecipe(
          await postJson<RecipeDto>("/recipes", {
            profileId,
            title,
            options,
            tone: "ramsay",
          }),
        );
        setTab("Heute");
      } catch (err) {
        fail(err);
      } finally {
        setBusy(null);
      }
    },
    [profileId, options],
  );

  const loadTechnique = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setBusy("technique");
    setError(null);
    try {
      setTechnique(
        await postJson<TechniqueDto>("/techniques", { query, tone: "ramsay" }),
      );
      setTab("Techniken");
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  }, []);

  // Deep links from the tile: an idea to write up, or a technique to explain.
  useEffect(() => {
    if (params.idea) void write(params.idea);
    else if (params.technique) void loadTechnique(params.technique);
    else if (params.recipe) {
      void fetch(`${API}/recipes/${params.recipe}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((r) => r && setRecipe(r as RecipeDto));
    }
    // Deep-link params are read once, on entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const adapt = useCallback(
    async (change: string) => {
      if (!recipe) return;
      setBusy("adapt");
      try {
        setRecipe(
          await postJson<RecipeDto>("/recipes/adapt", {
            recipe,
            change,
            tone: "ramsay",
          }),
        );
      } catch (err) {
        fail(err);
      } finally {
        setBusy(null);
      }
    },
    [recipe],
  );

  const rescale = useCallback(
    async (servings: number) => {
      if (!recipe) return;
      setRecipe(
        await postJson<RecipeDto>("/recipes/scale", { recipe, servings }),
      );
    },
    [recipe],
  );

  const save = useCallback(async () => {
    if (!recipe) return;
    const saved = await postJson<RecipeDto>("/recipes/save", {
      profileId,
      recipe,
      tags: [],
    });
    setRecipe(saved);
    await queryClient.invalidateQueries({ queryKey: ["kitchen-coach"] });
  }, [recipe, profileId, queryClient]);

  const finish = useCallback(
    async (rating: number | null, notes: string) => {
      if (!recipe) return;
      await postJson("/recipes/finish", {
        profileId,
        recipeId: recipe.id,
        title: recipe.title,
        rating,
        notes,
      });
      setCooking(false);
      await queryClient.invalidateQueries({ queryKey: ["kitchen-coach"] });
    },
    [recipe, profileId, queryClient],
  );

  if (cooking && recipe) {
    return (
      <Box maxW="1000px" mx="auto" px="4" py="6">
        <CookMode
          recipe={recipe}
          onFinish={(rating, notes) => void finish(rating, notes)}
          onClose={() => setCooking(false)}
          speak={(text) => speech.speak(text)}
          canSpeak={speech.supported}
        />
      </Box>
    );
  }

  return (
    <Box
      maxW="1000px"
      mx="auto"
      px={{ base: "4", md: "6" }}
      py={{ base: "4", md: "6" }}
    >
      <Flex justify="space-between" align="baseline" mb="4" gap="4">
        <Box>
          <Text fontSize="22px" fontWeight="medium" letterSpacing="0.02em">
            Küche
          </Text>
          <Text textStyle="label">
            {SLOT_LABELS[slot]} · {options.servings} Personen
          </Text>
        </Box>
        <NextLink href={backHref} style={{ textDecoration: "none" }}>
          <Text textStyle="label" color="link">
            ← dashboard
          </Text>
        </NextLink>
      </Flex>

      <Flex gap="2" mb="4" wrap="wrap">
        {TABS.map((t) => (
          <Chip
            key={t}
            label={t}
            active={tab === t}
            onClick={() => setTab(t)}
          />
        ))}
      </Flex>

      {error ? (
        <Text fontSize="sm" color="danger" mb="3">
          {error}
        </Text>
      ) : null}

      <Flex
        gap="4"
        align="flex-start"
        direction={{ base: "column", lg: "row" }}
      >
        <Box
          layerStyle="tile"
          p={{ base: "4", md: "5" }}
          flex="1"
          minW="0"
          w="100%"
        >
          {busy === "recipe" || busy === "technique" ? (
            <Text fontSize="sm" color="fg.muted">
              Der Chef schreibt…
            </Text>
          ) : tab === "Heute" ? (
            recipe ? (
              <Stack gap="4">
                <Flex gap="2" wrap="wrap" justify="flex-end">
                  <Chip
                    label="Kochmodus"
                    active
                    onClick={() => setCooking(true)}
                  />
                  <Chip label="Speichern" onClick={() => void save()} />
                  <Chip
                    label="Frag den Chef"
                    onClick={() => setChatOpen(true)}
                  />
                  <Flex
                    layerStyle="inset"
                    borderRadius="control"
                    px="3"
                    py="1"
                    gap="2"
                    align="center"
                  >
                    <Text textStyle="meta">Essen um</Text>
                    <Input
                      type="time"
                      size="xs"
                      w="90px"
                      variant="subtle"
                      bg="transparent"
                      border="none"
                      onChange={(e) => {
                        const [h, m] = e.target.value.split(":").map(Number);
                        if (h === undefined || m === undefined)
                          return setMealTime(null);
                        const when = new Date();
                        when.setHours(h, m, 0, 0);
                        setMealTime(when);
                      }}
                      aria-label="Essenszeit"
                    />
                  </Flex>
                </Flex>
                <RecipeView
                  recipe={recipe}
                  scheduleFrom={mealTime}
                  busy={busy === "adapt"}
                  onServings={(s) => void rescale(s)}
                  onVariation={(label) => void adapt(`Variation: ${label}`)}
                  onDevice={(device) => void adapt(`Auf ${device} umstellen`)}
                />
              </Stack>
            ) : (
              <Text fontSize="sm" color="fg.muted">
                Noch kein Rezept offen. Hol dir im Widget Ideen, oder öffne eins
                aus dem Kochbuch.
              </Text>
            )
          ) : tab === "Kochbuch" ? (
            <Stack gap="2">
              {(cookbook.data?.recipes ?? []).length === 0 ? (
                <Text fontSize="sm" color="fg.muted">
                  Noch nichts gespeichert. Was du kochst, landet hier.
                </Text>
              ) : (
                cookbook.data?.recipes.map((r) => (
                  <Flex
                    key={r.id}
                    justify="space-between"
                    align="center"
                    py="2"
                    borderBottomWidth="1px"
                    borderColor="border"
                    gap="3"
                  >
                    <chakra.button
                      type="button"
                      textAlign="left"
                      flex="1"
                      minW="0"
                      cursor="pointer"
                      color="fg"
                      onClick={() =>
                        void fetch(`${API}/recipes/${r.id}`)
                          .then((res) => res.json())
                          .then((full) => {
                            setRecipe(full as RecipeDto);
                            setTab("Heute");
                          })
                      }
                    >
                      <Text fontSize="14px">{r.title}</Text>
                      <Text textStyle="meta">
                        {r.servings} Pers.
                        {r.timesCooked ? ` · ${r.timesCooked}× gekocht` : ""}
                      </Text>
                    </chakra.button>
                    <Chip
                      label={r.favorite ? "★" : "☆"}
                      onClick={() =>
                        void fetch(`${API}/recipes/${r.id}`, {
                          method: "PATCH",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ favorite: !r.favorite }),
                        }).then(() =>
                          queryClient.invalidateQueries({
                            queryKey: ["kitchen-coach"],
                          }),
                        )
                      }
                    />
                  </Flex>
                ))
              )}
            </Stack>
          ) : tab === "Techniken" ? (
            <Stack gap="3">
              <Flex gap="2" align="center">
                <Flex
                  layerStyle="inset"
                  borderRadius="control"
                  px="3.5"
                  py="2"
                  flex="1"
                >
                  <Input
                    variant="subtle"
                    bg="transparent"
                    border="none"
                    px="0"
                    h="auto"
                    fontSize="13px"
                    placeholder="Avocado schneiden, Zwiebel würfeln, Emulsion retten…"
                    value={techniqueQuery}
                    onChange={(e) => setTechniqueQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void loadTechnique(techniqueQuery);
                    }}
                    _focusVisible={{ outline: "none" }}
                    aria-label="Technik"
                  />
                </Flex>
                <Button
                  size="sm"
                  bg="accent.solid"
                  color="accent.fg"
                  onClick={() => void loadTechnique(techniqueQuery)}
                >
                  Zeig mir
                </Button>
              </Flex>
              {technique ? (
                <TechniqueCard
                  card={technique}
                  onIdeas={() => setTab("Heute")}
                  onAsk={() => setChatOpen(true)}
                />
              ) : (
                <Text fontSize="sm" color="fg.muted">
                  Frag nach einem Handgriff. Der Chef erklärt Werkzeug,
                  Sicherheit, Schritte und die typischen Fehler.
                </Text>
              )}
            </Stack>
          ) : (
            <ProfileTab
              profileId={profileId}
              profile={profile}
              history={profileQuery.data?.history ?? []}
              onSaved={() =>
                queryClient.invalidateQueries({ queryKey: ["kitchen-coach"] })
              }
            />
          )}
        </Box>

        {chatOpen ? (
          <Box
            layerStyle="tile"
            p="4"
            w={{ base: "100%", lg: "360px" }}
            h={{ base: "auto", lg: "560px" }}
            flexShrink={0}
          >
            <ChefChat
              profileId={profileId}
              recipe={recipe}
              tone="ramsay"
              language="de"
              model="balanced"
              onClose={() => setChatOpen(false)}
            />
          </Box>
        ) : null}
      </Flex>
    </Box>
  );
}

function ProfileTab({
  profileId,
  profile,
  history,
  onSaved,
}: {
  profileId: string;
  profile: KitchenProfileDto;
  history: CookLogEntryDto[];
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(profile);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(profile), [profile]);

  const field = (
    label: string,
    value: string[],
    key: keyof KitchenProfileDto,
  ) => (
    <Box>
      <Text textStyle="label" mb="1">
        {label}
      </Text>
      <Input
        size="sm"
        value={value.join(", ")}
        onChange={(e) =>
          setDraft({
            ...draft,
            [key]: e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          })
        }
        aria-label={label}
      />
    </Box>
  );

  return (
    <Stack gap="3">
      <Flex gap="3" wrap="wrap">
        <Box minW="120px">
          <Text textStyle="label" mb="1">
            personen
          </Text>
          <Input
            size="sm"
            type="number"
            value={draft.servings}
            onChange={(e) =>
              setDraft({ ...draft, servings: Number(e.target.value) || 1 })
            }
            aria-label="Personen"
          />
        </Box>
        <Box minW="120px">
          <Text textStyle="label" mb="1">
            anstupser um
          </Text>
          <Input
            size="sm"
            type="time"
            value={draft.dinnerNudgeAt}
            onChange={(e) =>
              setDraft({ ...draft, dinnerNudgeAt: e.target.value })
            }
            aria-label="Anstupser"
          />
        </Box>
        <Box minW="120px">
          <Text textStyle="label" mb="1">
            zeit werktags
          </Text>
          <Input
            size="sm"
            type="number"
            value={draft.weekdayMinutes}
            onChange={(e) =>
              setDraft({
                ...draft,
                weekdayMinutes: Number(e.target.value) || 30,
              })
            }
            aria-label="Zeit werktags"
          />
        </Box>
      </Flex>
      {field("ernährung", draft.diets, "diets")}
      {field("allergien", draft.allergies, "allergies")}
      {field("mag ich nicht", draft.dislikes, "dislikes")}
      {field("immer da", draft.basics, "basics")}
      {field("küchen-extras", draft.extraDevices, "extraDevices")}

      <Flex justify="space-between" align="center" gap="3">
        <Button
          size="sm"
          bg="accent.solid"
          color="accent.fg"
          loading={saving}
          onClick={async () => {
            setSaving(true);
            await fetch(`${API}/profile`, {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ profileId, profile: draft }),
            });
            setSaving(false);
            onSaved();
          }}
        >
          Speichern
        </Button>
        <Text textStyle="meta">
          {history.length
            ? `${history.length} Einträge im Kochbuch-Log`
            : "noch nichts gekocht"}
        </Text>
      </Flex>
    </Stack>
  );
}
