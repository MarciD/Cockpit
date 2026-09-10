"use client";

import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Box, Button, Link, Stack, Text } from "@chakra-ui/react";
import { defineWidget, type WidgetComponentProps } from "@cockpit/widget-sdk";
import { ExerciseView } from "./ui/exercise-view";
import { ScoreStrip } from "./ui/score-strip";
import {
  localToday,
  type Exercise,
  type Hint,
  type ScoreSummary,
} from "./types";

const configSchema = z.object({
  language: z.string(),
  nativeLanguage: z.string(),
  dailyGoalItems: z.number(),
  focusNote: z.string(),
});
type Config = z.infer<typeof configSchema>;

interface Data {
  profileId: string;
  language: string;
  native: string;
  goalItems: number;
  focusNote: string;
  configured: boolean;
  hasItems: boolean;
  score: ScoreSummary | null;
}

const JSON_HEADERS = { "content-type": "application/json" };

function fullAppHref(data: Data): string {
  const params = new URLSearchParams({
    profile: data.profileId,
    language: data.language,
    native: data.native,
  });
  if (data.focusNote) params.set("focus", data.focusNote);
  return `/w/language-learning?${params.toString()}`;
}

function Panel({
  config,
  data,
  onOpenSettings,
}: WidgetComponentProps<Config, Data>) {
  const queryClient = useQueryClient();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [score, setScore] = useState<ScoreSummary | null>(data.score);

  useEffect(() => setScore(data.score), [data.score]);

  const loadNext = useCallback(async () => {
    if (!data.hasItems) return;
    const res = await fetch(
      `/api/w/language-learning/next?profileId=${encodeURIComponent(data.profileId)}&language=${encodeURIComponent(data.language)}&count=1&mode=general`,
    );
    if (!res.ok) return;
    const json = (await res.json()) as { exercises: Exercise[] };
    setExercise(json.exercises[0] ?? null);
  }, [data.hasItems, data.profileId, data.language]);

  useEffect(() => {
    void loadNext();
  }, [loadNext]);

  const requestHint = useCallback(
    async (itemId: string): Promise<Hint> => {
      const res = await fetch("/api/w/language-learning/hint", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          profileId: data.profileId,
          language: data.language,
          native: data.native,
          itemId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json.error === "needs-connect" ? "needs-connect" : String(json.error),
        );
      }
      return json as Hint;
    },
    [data.profileId, data.language, data.native],
  );

  const handleResult = useCallback(
    async (correct: boolean) => {
      if (!exercise) return;
      const res = await fetch("/api/w/language-learning/answer", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          profileId: data.profileId,
          language: data.language,
          itemId: exercise.itemId,
          correct,
          mode: "general",
          today: localToday(),
          dailyGoalItems: data.goalItems,
        }),
      });
      if (res.ok) setScore((await res.json()) as ScoreSummary);
      await queryClient.invalidateQueries({
        queryKey: ["language-learning", data.profileId, data.language],
      });
      await loadNext();
    },
    [
      exercise,
      data.profileId,
      data.language,
      data.goalItems,
      loadNext,
      queryClient,
    ],
  );

  if (!data.configured) {
    return (
      <Stack
        gap="3"
        h="100%"
        justify="center"
        align="center"
        textAlign="center"
      >
        <Text fontSize="sm" color="fg.muted">
          Set a language to start learning.
        </Text>
        <Button
          size="sm"
          layerStyle="raised"
          color="fg"
          onClick={onOpenSettings}
        >
          Open settings
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap="3.5" h="100%" w="100%">
      {score ? <ScoreStrip summary={score} /> : null}

      <Box flex="1" minH="0" overflowY="auto">
        {!data.hasItems ? (
          <Stack gap="2" py="2">
            <Text fontSize="sm" color="fg.muted">
              No {config.language} vocabulary yet.
            </Text>
            <Link
              href={fullAppHref(data)}
              color="link"
              fontSize="sm"
              _hover={{ color: "link.hover" }}
            >
              Import a CSV in the full app →
            </Link>
          </Stack>
        ) : exercise ? (
          <ExerciseView
            exercise={exercise}
            onResult={handleResult}
            onRequestHint={requestHint}
            language={data.language}
          />
        ) : (
          <Text fontSize="sm" color="fg.muted">
            Loading…
          </Text>
        )}
      </Box>

      <Link
        href={fullAppHref(data)}
        color="link"
        textStyle="label"
        _hover={{ color: "link.hover" }}
        alignSelf="flex-start"
      >
        Open full app →
      </Link>
    </Stack>
  );
}

const languageLearningWidget = defineWidget<Config, Data>({
  id: "language-learning",
  title: "Language",
  description: "Vocabulary practice for a language you set, with a full app.",
  icon: () => <span aria-hidden>✎</span>,
  category: "custom",
  configSchema,
  defaultConfig: {
    language: "",
    nativeLanguage: "German",
    dailyGoalItems: 10,
    focusNote: "",
  },
  layout: { defaultW: 3, defaultH: 6, minW: 3, minH: 4, mobileH: 5 },
  data: {
    queryKey: (config, profileId) => [
      "language-learning",
      profileId,
      config.language,
    ],
    queryFn: async (ctx, config): Promise<Data> => {
      const base: Data = {
        profileId: ctx.profileId,
        language: config.language,
        native: config.nativeLanguage,
        goalItems: config.dailyGoalItems,
        focusNote: config.focusNote,
        configured: Boolean(config.language.trim()),
        hasItems: false,
        score: null,
      };
      if (!base.configured) return base;

      const q = `profileId=${encodeURIComponent(ctx.profileId)}&language=${encodeURIComponent(config.language)}`;
      const [scoreRes, itemsRes] = await Promise.all([
        fetch(
          `/api/w/language-learning/score?${q}&today=${localToday()}&goal=${config.dailyGoalItems}`,
          { signal: ctx.signal },
        ),
        fetch(`/api/w/language-learning/items?${q}`, { signal: ctx.signal }),
      ]);
      const score = scoreRes.ok
        ? ((await scoreRes.json()) as ScoreSummary)
        : null;
      const items = itemsRes.ok
        ? ((await itemsRes.json()) as { items: unknown[] })
        : { items: [] };
      return { ...base, score, hasItems: items.items.length > 0 };
    },
    staleTimeMs: 15_000,
    manualRefresh: true,
  },
  count: (data) => {
    if (!data.configured || !data.score) return undefined;
    const left = data.score.goalItems - data.score.itemsAnswered;
    return left > 0 ? `${left} to go` : "done";
  },
  describe: (config, data) => {
    if (!data.configured) return null;
    if (!data.hasItems)
      return `${config.language}: no vocabulary imported yet.`;
    const s = data.score;
    if (!s) return `${config.language} practice.`;
    return `${config.language}: ${s.itemsAnswered}/${s.goalItems} items today${
      s.streakDays > 0 ? `, ${s.streakDays}-day streak` : ""
    }.`;
  },
  Component: Panel,
});

export default languageLearningWidget;
