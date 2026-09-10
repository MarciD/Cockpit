"use client";

import { useMemo } from "react";
import { Box, Button, HStack, Stack, Text, chakra } from "@chakra-ui/react";
import { ExerciseView } from "./exercise-view";
import { SentenceTaskView } from "./sentence-task-view";
import { SpeakButton } from "./speak-button";
import { VerbLessonPanel } from "./verb-lesson";
import {
  localToday,
  type FlashcardExercise,
  type TopicSession,
  type VocabItem,
} from "../types";

const JSON_HEADERS = { "content-type": "application/json" };

type Phase = "present" | "practice" | "verbs" | "produce" | "summary";
const PHASE_LABELS: Record<Phase, string> = {
  present: "Learn",
  practice: "Practice",
  verbs: "Verbs",
  produce: "Sentences",
  summary: "Done",
};

/** Where the learner is within a session — persisted so it survives a reload. */
export interface SessionCursor {
  phaseIdx: number;
  practiceIdx: number;
  verbIdx: number;
  taskIdx: number;
}

export const INITIAL_CURSOR: SessionCursor = {
  phaseIdx: 0,
  practiceIdx: 0,
  verbIdx: 0,
  taskIdx: 0,
};

/** The full resumable state of a topic session: the plan plus the cursor. */
export interface ActiveSession {
  session: TopicSession;
  cursor: SessionCursor;
}

interface SessionRunnerProps {
  profileId: string;
  language: string;
  native: string;
  focusNote?: string;
  session: TopicSession;
  /** Controlled cursor (owned + persisted by the parent). */
  cursor: SessionCursor;
  onCursor: (next: SessionCursor) => void;
  /** Full deck (to resolve item ids for the just-learned words). */
  items: VocabItem[];
  onProgress: () => void;
  onExit: () => void;
}

export function SessionRunner(props: SessionRunnerProps) {
  const { session } = props;

  const verbItems = useMemo(
    () => session.plan.items.filter((i) => i.category === "verb_infinitive"),
    [session.plan.items],
  );

  const phases = useMemo<Phase[]>(() => {
    const p: Phase[] = [];
    if (session.plan.items.length > 0) p.push("present", "practice");
    if (verbItems.length > 0) p.push("verbs");
    if (session.tasks.length > 0) p.push("produce");
    p.push("summary");
    return p;
  }, [session.plan.items.length, session.tasks.length, verbItems.length]);

  const { phaseIdx, practiceIdx, verbIdx, taskIdx } = props.cursor;

  const phase = phases[phaseIdx] ?? "summary";
  const update = (patch: Partial<SessionCursor>) =>
    props.onCursor({ ...props.cursor, ...patch });
  const advance = () =>
    update({ phaseIdx: Math.min(phaseIdx + 1, phases.length - 1) });

  const idByTerm = useMemo(() => {
    const map = new Map<string, string>();
    for (const it of props.items) {
      map.set(it.term.trim().toLowerCase(), it.id);
    }
    return map;
  }, [props.items]);

  const practiceExercises = useMemo<FlashcardExercise[]>(
    () =>
      session.plan.items.map((it) => ({
        kind: "flashcard",
        itemId: idByTerm.get(it.term.trim().toLowerCase()) ?? "",
        category: it.category,
        prompt: it.term,
        answer: it.translation,
        direction: "term_to_translation",
        note: it.notes ?? undefined,
      })),
    [session.plan.items, idByTerm],
  );

  const recordAnswer = (itemId: string, correct: boolean) => {
    if (!itemId) return;
    void fetch("/api/w/language-learning/answer", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        profileId: props.profileId,
        language: props.language,
        itemId,
        correct,
        mode: `topic:${session.topic}`,
        today: localToday(),
      }),
    }).then(() => props.onProgress());
  };

  return (
    <Stack gap="4">
      <HStack justify="space-between" align="center">
        <PhaseBar phases={phases} current={phase} />
        <Button
          size="xs"
          variant="ghost"
          color="fg.faint"
          onClick={props.onExit}
        >
          Exit
        </Button>
      </HStack>

      {phase === "present" ? (
        <Box layerStyle="tile" p="4">
          <Text textStyle="label" mb="3">
            New words & chunks
          </Text>
          <Stack gap="2.5">
            {session.plan.items.map((it) => (
              <HStack key={it.term} gap="2" align="center">
                <SpeakButton
                  text={it.term}
                  language={props.language}
                  size="2xs"
                />
                <Text fontSize="sm" color="fg" flex="1" minW="0">
                  {it.term}
                  <chakra.span color="fg.muted">
                    {" "}
                    · {it.translation}
                  </chakra.span>
                </Text>
                <Text textStyle="meta">{it.category.replace("_", " ")}</Text>
              </HStack>
            ))}
          </Stack>
          <Button
            mt="4"
            size="sm"
            bg="accent"
            color="accent.fg"
            _hover={{ bg: "accent.solid" }}
            onClick={advance}
          >
            Practice these →
          </Button>
        </Box>
      ) : null}

      {phase === "practice" && practiceExercises[practiceIdx] ? (
        <Box layerStyle="tile" p="4">
          <Text textStyle="meta" mb="2">
            {practiceIdx + 1} / {practiceExercises.length}
          </Text>
          <ExerciseView
            exercise={practiceExercises[practiceIdx]}
            language={props.language}
            continueLabel={
              practiceIdx + 1 >= practiceExercises.length ? "Finish" : "Next"
            }
            onResult={(correct) => {
              recordAnswer(practiceExercises[practiceIdx]!.itemId, correct);
              const next = practiceIdx + 1;
              if (next >= practiceExercises.length) advance();
              else update({ practiceIdx: next });
            }}
          />
        </Box>
      ) : null}

      {phase === "verbs" && verbItems[verbIdx] ? (
        <Box>
          <Text textStyle="meta" mb="2">
            Verb {verbIdx + 1} / {verbItems.length}
          </Text>
          <VerbLessonPanel
            key={verbItems[verbIdx]!.term}
            profileId={props.profileId}
            language={props.language}
            native={props.native}
            focusNote={props.focusNote}
            items={props.items}
            onProgress={props.onProgress}
            initialVerb={verbItems[verbIdx]!.term}
            onDone={() => {
              const next = verbIdx + 1;
              if (next >= verbItems.length) advance();
              else update({ verbIdx: next });
            }}
          />
        </Box>
      ) : null}

      {phase === "produce" && session.tasks[taskIdx] ? (
        <Box layerStyle="tile" p="4">
          <Text textStyle="meta" mb="2">
            Sentence {taskIdx + 1} / {session.tasks.length}
          </Text>
          <SentenceTaskView
            task={session.tasks[taskIdx]!}
            language={props.language}
            native={props.native}
            profileId={props.profileId}
            onDone={() => {
              const next = taskIdx + 1;
              if (next >= session.tasks.length) advance();
              else update({ taskIdx: next });
            }}
          />
        </Box>
      ) : null}

      {phase === "summary" ? (
        <Box layerStyle="tile" p="4">
          <Text fontSize="md" color="fg" mb="1">
            Session complete 🎉
          </Text>
          <Text textStyle="meta" mb="3">
            {session.newItems > 0
              ? `${session.newItems} new words saved · `
              : ""}
            {session.tasks.length} sentences · keep it up.
          </Text>
          <Button
            size="sm"
            bg="accent"
            color="accent.fg"
            _hover={{ bg: "accent.solid" }}
            onClick={props.onExit}
          >
            Back to topics
          </Button>
        </Box>
      ) : null}
    </Stack>
  );
}

function PhaseBar({ phases, current }: { phases: Phase[]; current: Phase }) {
  const activeIndex = phases.indexOf(current);
  return (
    <HStack gap="1.5" flexWrap="wrap">
      {phases.map((p, i) => (
        <Text
          key={p}
          textStyle="label"
          color={i <= activeIndex ? "accent.solid" : "fg.faint"}
        >
          {PHASE_LABELS[p]}
          {i < phases.length - 1 ? " ·" : ""}
        </Text>
      ))}
    </HStack>
  );
}
