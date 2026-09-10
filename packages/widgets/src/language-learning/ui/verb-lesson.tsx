"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  HStack,
  Input,
  Stack,
  Text,
  chakra,
} from "@chakra-ui/react";
import { SpeakButton } from "./speak-button";
import {
  localToday,
  normalizeAnswer,
  type Grade,
  type VerbLesson,
  type VocabItem,
} from "../types";

const JSON_HEADERS = { "content-type": "application/json" };

type Phase = "input" | "meet" | "pattern" | "drill" | "use" | "done";

interface VerbLessonPanelProps {
  profileId: string;
  language: string;
  native: string;
  focusNote?: string;
  items: VocabItem[];
  onProgress: () => void;
  /** Embedded in a session: auto-start with this verb. */
  initialVerb?: string;
  /** Embedded: called when the lesson finishes (replaces "Another verb"). */
  onDone?: () => void;
}

/** Split a form into (stem, ending) for highlighting, given the shared stem. */
function splitStem(form: string, stem: string): [string, string] {
  if (stem && form.toLowerCase().startsWith(stem.toLowerCase())) {
    return [form.slice(0, stem.length), form.slice(stem.length)];
  }
  return ["", form];
}

export function VerbLessonPanel(props: VerbLessonPanelProps) {
  const [verb, setVerb] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [lesson, setLesson] = useState<VerbLesson | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // drill state
  const [drillIndex, setDrillIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [checked, setChecked] = useState(false);

  // "use" state
  const [sentence, setSentence] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [grading, setGrading] = useState(false);

  const verbItemId = useMemo(() => {
    const key = verb.trim().toLowerCase();
    return props.items.find((i) => i.term.trim().toLowerCase() === key)?.id;
  }, [props.items, verb]);

  const start = useCallback(
    async (override?: string) => {
      const v = (override ?? verb).trim();
      if (!v) return;
      setVerb(v);
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/w/language-learning/verb/lesson", {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({
            language: props.language,
            native: props.native,
            verb: v,
            focusNote: props.focusNote,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(
            json.error === "needs-connect"
              ? "Connect an Anthropic key (Assistant widget) to use the verb trainer."
              : String(json.error),
          );
          return;
        }
        setLesson(json as VerbLesson);
        setPhase("meet");
        setDrillIndex(0);
        setPicked(null);
        setTyped("");
        setChecked(false);
        setSentence("");
        setGrade(null);
      } finally {
        setLoading(false);
      }
    },
    [verb, props.language, props.native, props.focusNote],
  );

  // Embedded in a session: auto-start with the provided verb.
  const initialVerb = props.initialVerb;
  useEffect(() => {
    if (initialVerb) void start(initialVerb);
    // Only when the target verb changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialVerb]);

  const recordMastery = useCallback(
    (correct: boolean) => {
      if (!verbItemId) return;
      void fetch("/api/w/language-learning/answer", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          profileId: props.profileId,
          language: props.language,
          itemId: verbItemId,
          correct,
          mode: "verb",
          today: localToday(),
        }),
      }).then(() => props.onProgress());
    },
    [verbItemId, props],
  );

  if (phase === "input" || !lesson) {
    if (props.initialVerb) {
      return error ? (
        <Text fontSize="sm" color="danger">
          {error}
        </Text>
      ) : (
        <Text fontSize="sm" color="fg.muted">
          Preparing “{props.initialVerb}”…
        </Text>
      );
    }
    return (
      <Stack gap="4">
        <Text fontSize="sm" color="fg.muted">
          Learn a verb step by step: meet it, see the pattern, drill each
          person, then use it in a sentence.
        </Text>
        <HStack gap="2">
          <Input
            size="sm"
            placeholder={`a ${props.language} verb…`}
            value={verb}
            onChange={(e) => setVerb(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && verb.trim() && !loading) void start();
            }}
          />
          <Button
            size="sm"
            bg="accent"
            color="accent.fg"
            _hover={{ bg: "accent.solid" }}
            loading={loading}
            disabled={!verb.trim()}
            onClick={() => void start()}
          >
            Learn
          </Button>
        </HStack>
        {error ? (
          <Text fontSize="sm" color="danger">
            {error}
          </Text>
        ) : null}
      </Stack>
    );
  }

  const t = lesson.table;
  const drills = lesson.drills;

  return (
    <Stack gap="4">
      <PhaseBar phase={phase} />

      {phase === "meet" ? (
        <Box layerStyle="tile" p="4">
          <HStack gap="2" align="center">
            <Text fontSize="xl" color="fg">
              {t.verb}
            </Text>
            <SpeakButton text={t.verb} language={props.language} />
          </HStack>
          <Text color="fg.muted" mb="3">
            {t.translation} · {t.tense}
          </Text>
          <Button
            size="sm"
            bg="accent"
            color="accent.fg"
            _hover={{ bg: "accent.solid" }}
            onClick={() => setPhase("pattern")}
          >
            See the pattern →
          </Button>
        </Box>
      ) : null}

      {phase === "pattern" ? (
        <Box layerStyle="tile" p="4">
          <Text textStyle="label" mb="3">
            {t.tense} · stem highlighted
          </Text>
          <Stack gap="1.5">
            {t.forms.map((f) => {
              const [stem, ending] = splitStem(f.form, lesson.stem);
              return (
                <HStack key={f.person} gap="3" align="center">
                  <Text textStyle="meta" minW="90px">
                    {f.person}
                  </Text>
                  <Text fontSize="sm" color="fg">
                    <chakra.span color="fg.muted">{stem}</chakra.span>
                    <chakra.span color="accent.solid" fontWeight="semibold">
                      {ending}
                    </chakra.span>
                  </Text>
                  <SpeakButton
                    text={f.form}
                    language={props.language}
                    size="2xs"
                  />
                </HStack>
              );
            })}
          </Stack>
          <Button
            mt="4"
            size="sm"
            bg="accent"
            color="accent.fg"
            _hover={{ bg: "accent.solid" }}
            onClick={() => setPhase("drill")}
          >
            Drill it →
          </Button>
        </Box>
      ) : null}

      {phase === "drill" && drills[drillIndex] ? (
        <DrillStep
          drill={drills[drillIndex]}
          index={drillIndex}
          total={drills.length}
          verb={t.verb}
          language={props.language}
          picked={picked}
          typed={typed}
          checked={checked}
          onPick={setPicked}
          onType={setTyped}
          onCheck={() => setChecked(true)}
          onNext={(correct) => {
            recordMastery(correct);
            const next = drillIndex + 1;
            setPicked(null);
            setTyped("");
            setChecked(false);
            if (next >= drills.length) setPhase("use");
            else setDrillIndex(next);
          }}
        />
      ) : null}

      {phase === "use" ? (
        <Box layerStyle="tile" p="4">
          <Text textStyle="label" mb="2">
            Use it in a sentence
          </Text>
          <Text fontSize="sm" color="fg.muted" mb="2">
            Write a short {props.language} sentence using{" "}
            <chakra.span color="accent.solid">{t.verb}</chakra.span>.
          </Text>
          <Input
            size="sm"
            placeholder="your sentence…"
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
          />
          <HStack gap="2" mt="2">
            <Button
              size="sm"
              bg="accent"
              color="accent.fg"
              _hover={{ bg: "accent.solid" }}
              loading={grading}
              disabled={!sentence.trim()}
              onClick={async () => {
                setGrading(true);
                try {
                  const res = await fetch("/api/w/language-learning/grade", {
                    method: "POST",
                    headers: JSON_HEADERS,
                    body: JSON.stringify({
                      profileId: props.profileId,
                      language: props.language,
                      native: props.native,
                      prompt: `Use the verb "${t.verb}" in a ${props.language} sentence.`,
                      answer: sentence,
                    }),
                  });
                  const json = await res.json();
                  if (res.ok) setGrade(json as Grade);
                } finally {
                  setGrading(false);
                }
              }}
            >
              Check
            </Button>
            <Button
              size="sm"
              variant="ghost"
              color="fg.muted"
              onClick={() => setPhase("done")}
            >
              Finish
            </Button>
          </HStack>
          {grade ? (
            <Stack gap="1" layerStyle="inset" p="3" mt="3">
              <Text fontSize="sm" color={grade.correct ? "success" : "fg"}>
                {grade.correct
                  ? "✓ Looks good"
                  : (grade.mainError ?? "Review it")}
              </Text>
              {grade.corrected ? (
                <Text textStyle="meta">→ {grade.corrected}</Text>
              ) : null}
              {grade.warnings.map((w) => (
                <Text key={w} fontSize="xs" color="warning">
                  ⚠ {w}
                </Text>
              ))}
            </Stack>
          ) : null}
        </Box>
      ) : null}

      {phase === "done" ? (
        <Box layerStyle="tile" p="4">
          <Text fontSize="sm" color="fg">
            Nice — you worked through <strong>{t.verb}</strong>.
          </Text>
          {props.onDone ? (
            <Button
              mt="3"
              size="sm"
              bg="accent"
              color="accent.fg"
              _hover={{ bg: "accent.solid" }}
              onClick={props.onDone}
            >
              Continue →
            </Button>
          ) : (
            <Button
              mt="3"
              size="sm"
              layerStyle="raised"
              color="fg"
              onClick={() => {
                setPhase("input");
                setVerb("");
                setLesson(null);
              }}
            >
              Another verb
            </Button>
          )}
        </Box>
      ) : null}
    </Stack>
  );
}

const PHASES: Array<{ key: Phase; label: string }> = [
  { key: "meet", label: "Meet" },
  { key: "pattern", label: "Pattern" },
  { key: "drill", label: "Drill" },
  { key: "use", label: "Use" },
];

function PhaseBar({ phase }: { phase: Phase }) {
  const activeIndex = PHASES.findIndex((p) => p.key === phase);
  return (
    <HStack gap="1.5" flexWrap="wrap">
      {PHASES.map((p, i) => (
        <Text
          key={p.key}
          textStyle="label"
          color={i <= activeIndex ? "accent.solid" : "fg.faint"}
        >
          {p.label}
          {i < PHASES.length - 1 ? " ·" : ""}
        </Text>
      ))}
    </HStack>
  );
}

function DrillStep(props: {
  drill: { person: string; answer: string; options: string[] };
  index: number;
  total: number;
  verb: string;
  language: string;
  picked: string | null;
  typed: string;
  checked: boolean;
  onPick: (v: string) => void;
  onType: (v: string) => void;
  onCheck: () => void;
  onNext: (correct: boolean) => void;
}) {
  const { drill } = props;
  // First half of persons: receptive (pick); second half: productive (type).
  const receptive = props.index < Math.ceil(props.total / 2);

  if (receptive) {
    const answered = props.picked !== null;
    const correct = props.picked === drill.answer;
    return (
      <Box layerStyle="tile" p="4">
        <Text textStyle="meta" mb="2">
          {props.index + 1} / {props.total} · pick the form
        </Text>
        <Text fontSize="md" color="fg" mb="3">
          <chakra.span color="accent.solid">{drill.person}</chakra.span> —{" "}
          {props.verb}
        </Text>
        <Stack gap="2">
          {drill.options.map((opt) => {
            let border = "transparent";
            if (answered && opt === drill.answer)
              border = "var(--chakra-colors-success)";
            else if (answered && opt === props.picked)
              border = "var(--chakra-colors-danger)";
            return (
              <Button
                key={opt}
                size="sm"
                layerStyle="raised"
                color="fg"
                justifyContent="flex-start"
                borderWidth="2px"
                borderColor={border}
                disabled={answered}
                _disabled={{ opacity: 1, cursor: "default" }}
                onClick={() => props.onPick(opt)}
              >
                {opt}
              </Button>
            );
          })}
        </Stack>
        {answered ? (
          <Button
            mt="3"
            size="sm"
            bg="accent"
            color="accent.fg"
            _hover={{ bg: "accent.solid" }}
            onClick={() => props.onNext(correct)}
          >
            {props.index + 1 >= props.total ? "Finish" : "Next"}
          </Button>
        ) : null}
      </Box>
    );
  }

  // productive
  const correct =
    props.checked &&
    normalizeAnswer(props.typed) === normalizeAnswer(drill.answer);
  return (
    <Box layerStyle="tile" p="4">
      <Text textStyle="meta" mb="2">
        {props.index + 1} / {props.total} · type the form
      </Text>
      <Text fontSize="md" color="fg" mb="3">
        <chakra.span color="accent.solid">{drill.person}</chakra.span> —{" "}
        {props.verb}
      </Text>
      <Input
        size="sm"
        placeholder="conjugated form…"
        value={props.typed}
        disabled={props.checked}
        onChange={(e) => props.onType(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && props.typed.trim() && !props.checked)
            props.onCheck();
        }}
      />
      {props.checked ? (
        <Stack gap="2" mt="3">
          <Text fontSize="sm" color={correct ? "success" : "danger"}>
            {correct ? "✓ Correct" : `✗ ${drill.answer}`}
          </Text>
          <Button
            size="sm"
            bg="accent"
            color="accent.fg"
            _hover={{ bg: "accent.solid" }}
            onClick={() => props.onNext(correct)}
          >
            {props.index + 1 >= props.total ? "Finish" : "Next"}
          </Button>
        </Stack>
      ) : (
        <Button
          mt="3"
          size="sm"
          layerStyle="raised"
          color="fg"
          disabled={!props.typed.trim()}
          onClick={props.onCheck}
        >
          Check
        </Button>
      )}
    </Box>
  );
}
