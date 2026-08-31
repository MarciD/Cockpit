"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Heading,
  HStack,
  Input,
  Link,
  Stack,
  Text,
  Textarea,
  chakra,
} from "@chakra-ui/react";
import { ExerciseView } from "../ui/exercise-view";
import { ScoreStrip } from "../ui/score-strip";
import {
  INITIAL_CURSOR,
  SessionRunner,
  type ActiveSession,
} from "../ui/session-runner";
import { SessionErrorBoundary } from "../ui/session-error-boundary";
import { SpeakButton } from "../ui/speak-button";
import { VerbLessonPanel } from "../ui/verb-lesson";
import {
  clearPersisted,
  sessionStorageKey,
  usePersistentState,
} from "../ui/use-persistent-state";
import {
  CATEGORIES,
  localToday,
  PRACTICE_MODE_LABELS,
  type Category,
  type Exercise,
  type Grade,
  type Hint,
  type PracticeMode,
  type ScoreSummary,
  type Topic,
  type TopicSession,
  type VocabItem,
} from "../types";

export interface LanguageLearningPageProps {
  profileId: string;
  language: string;
  native: string;
  focusNote?: string;
  /** Href back to the originating desk. */
  backHref: string;
}

const JSON_HEADERS = { "content-type": "application/json" };
const TABS = ["Sessions", "Practice", "Browse", "Verbs", "Stats"] as const;
type Tab = (typeof TABS)[number];
const MODES: PracticeMode[] = ["words", "verbs", "level", "general"];
const SESSION_SIZE = 8;

const Select = chakra("select", {
  base: {
    fontSize: "sm",
    px: "2",
    py: "1.5",
    borderRadius: "small",
    layerStyle: "inset",
    color: "fg",
  },
});

export function LanguageLearningPage(props: LanguageLearningPageProps) {
  const { profileId, language, native } = props;
  const [tab, setTab] = useState<Tab>("Sessions");
  const [score, setScore] = useState<ScoreSummary | null>(null);
  const [items, setItems] = useState<VocabItem[]>([]);
  // Bumping this remounts the panels under the error boundary (recovery path).
  const [boundaryGen, setBoundaryGen] = useState(0);
  const sessionKey = sessionStorageKey(profileId, language);

  const q = useMemo(
    () =>
      `profileId=${encodeURIComponent(profileId)}&language=${encodeURIComponent(language)}`,
    [profileId, language],
  );

  const refreshScore = useCallback(async () => {
    const res = await fetch(`/api/learn/score?${q}&today=${localToday()}`);
    if (res.ok) setScore((await res.json()) as ScoreSummary);
  }, [q]);

  const refreshItems = useCallback(async () => {
    const res = await fetch(`/api/learn/items?${q}`);
    if (res.ok) setItems(((await res.json()) as { items: VocabItem[] }).items);
  }, [q]);

  useEffect(() => {
    void refreshScore();
    void refreshItems();
  }, [refreshScore, refreshItems]);

  return (
    <Box maxW="820px" mx="auto" px="4" py="6">
      <HStack justify="space-between" align="baseline" mb="1">
        <Heading size="lg" color="fg">
          {language}
        </Heading>
        <Link
          href={props.backHref}
          color="link"
          textStyle="label"
          _hover={{ color: "link.hover" }}
        >
          ← Dashboard
        </Link>
      </HStack>
      <Text textStyle="meta" mb="4">
        into {native} · {items.length} items
      </Text>

      {score ? (
        <Box layerStyle="tile" p="4" mb="5">
          <ScoreStrip summary={score} />
        </Box>
      ) : null}

      <HStack gap="1.5" mb="5" flexWrap="wrap">
        {TABS.map((t) => (
          <Button
            key={t}
            size="sm"
            layerStyle={t === tab ? "inset" : "raised"}
            color={t === tab ? "accent.solid" : "fg.muted"}
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </HStack>

      <SessionErrorBoundary
        // Remount on tab switch (clears a stale error) or explicit recovery.
        key={`${tab}:${boundaryGen}`}
        onResume={() => setBoundaryGen((g) => g + 1)}
        onStartOver={() => {
          clearPersisted(sessionKey);
          setBoundaryGen((g) => g + 1);
        }}
      >
        {tab === "Sessions" ? (
          <SessionsPanel
            profileId={profileId}
            language={language}
            native={native}
            focusNote={props.focusNote}
            items={items}
            onProgress={() => {
              void refreshScore();
            }}
            refreshItems={refreshItems}
          />
        ) : null}
        {tab === "Practice" ? (
          <PracticePanel
            q={q}
            profileId={profileId}
            language={language}
            native={native}
            goalItems={score?.goalItems}
            items={items}
            onProgress={() => {
              void refreshScore();
            }}
            onSessionEnd={() => {
              void refreshItems();
            }}
          />
        ) : null}
        {tab === "Browse" ? (
          <BrowsePanel
            profileId={profileId}
            language={language}
            items={items}
            onChange={refreshItems}
          />
        ) : null}
        {tab === "Verbs" ? (
          <VerbLessonPanel
            profileId={profileId}
            language={language}
            native={native}
            focusNote={props.focusNote}
            items={items}
            onProgress={() => {
              void refreshScore();
              void refreshItems();
            }}
          />
        ) : null}
        {tab === "Stats" ? (
          <StatsPanel
            q={q}
            profileId={profileId}
            language={language}
            native={native}
            items={items}
            onImport={refreshItems}
          />
        ) : null}
      </SessionErrorBoundary>
    </Box>
  );
}

// --- Sessions ---------------------------------------------------------------

function SessionsPanel(props: {
  profileId: string;
  language: string;
  native: string;
  focusNote?: string;
  items: VocabItem[];
  onProgress: () => void;
  refreshItems: () => Promise<void>;
}) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [custom, setCustom] = useState("");
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The in-progress session is persisted, so a crash/reload can resume it.
  const [active, setActive] = usePersistentState<ActiveSession | null>(
    sessionStorageKey(props.profileId, props.language),
    null,
  );

  useEffect(() => {
    void fetch("/api/learn/session/topics").then(async (r) => {
      if (r.ok) setTopics(((await r.json()) as { topics: Topic[] }).topics);
    });
  }, []);

  const needsConnect =
    "Connect an Anthropic key (Assistant widget) to start sessions.";

  const startTopic = async (topic: string) => {
    if (!topic.trim()) return;
    setStarting(topic);
    setError(null);
    try {
      const res = await fetch("/api/learn/session/topic", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          profileId: props.profileId,
          language: props.language,
          native: props.native,
          topic,
          focusNote: props.focusNote,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(
          json.error === "needs-connect" ? needsConnect : String(json.error),
        );
        return;
      }
      await props.refreshItems();
      setActive({ session: json as TopicSession, cursor: INITIAL_CURSOR });
    } finally {
      setStarting(null);
    }
  };

  const startSentences = async () => {
    setStarting("__sentences__");
    setError(null);
    try {
      const res = await fetch("/api/learn/session/sentences", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          profileId: props.profileId,
          language: props.language,
          native: props.native,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(
          json.error === "needs-connect" ? needsConnect : String(json.error),
        );
        return;
      }
      setActive({
        session: {
          topic: "Sentences",
          newItems: 0,
          plan: { topic: "Sentences", items: [], sentences: [] },
          tasks: (json as { tasks: TopicSession["tasks"] }).tasks,
        },
        cursor: INITIAL_CURSOR,
      });
    } finally {
      setStarting(null);
    }
  };

  if (active) {
    return (
      <SessionRunner
        profileId={props.profileId}
        language={props.language}
        native={props.native}
        focusNote={props.focusNote}
        session={active.session}
        cursor={active.cursor}
        onCursor={(cursor) => setActive({ session: active.session, cursor })}
        items={props.items}
        onProgress={props.onProgress}
        onExit={() => {
          setActive(null);
          void props.refreshItems();
        }}
      />
    );
  }

  return (
    <Stack gap="4">
      <Text fontSize="sm" color="fg.muted">
        Pick a scene to learn its words, verbs, and sentences — most useful
        first.
      </Text>
      <Box
        display="grid"
        gridTemplateColumns="repeat(auto-fill, minmax(150px, 1fr))"
        gap="2"
      >
        {topics.map((t) => (
          <Button
            key={t.slug}
            layerStyle="raised"
            color="fg"
            size="sm"
            justifyContent="flex-start"
            loading={starting === t.slug}
            onClick={() => startTopic(t.slug)}
          >
            {t.label}
          </Button>
        ))}
      </Box>
      <HStack gap="2">
        <Input
          size="sm"
          placeholder="custom topic…"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && custom.trim())
              void startTopic(custom.trim());
          }}
        />
        <Button
          size="sm"
          bg="accent"
          color="accent.fg"
          _hover={{ bg: "accent.solid" }}
          loading={starting === custom.trim() && custom.trim() !== ""}
          disabled={!custom.trim()}
          onClick={() => startTopic(custom.trim())}
        >
          Start
        </Button>
      </HStack>
      <Button
        size="sm"
        variant="ghost"
        color="fg.muted"
        alignSelf="flex-start"
        loading={starting === "__sentences__"}
        disabled={props.items.length === 0}
        onClick={startSentences}
      >
        Or: train sentences with my current vocabulary →
      </Button>
      {error ? (
        <Text fontSize="sm" color="danger">
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}

// --- Practice ---------------------------------------------------------------

function PracticePanel(props: {
  q: string;
  profileId: string;
  language: string;
  native: string;
  goalItems?: number;
  items: VocabItem[];
  onProgress: () => void;
  onSessionEnd: () => void;
}) {
  const [mode, setMode] = useState<PracticeMode>("general");
  const [batch, setBatch] = useState<Exercise[] | null>(null);
  const [index, setIndex] = useState(0);

  const start = useCallback(async () => {
    const res = await fetch(
      `/api/learn/next?${props.q}&mode=${mode}&count=${SESSION_SIZE}`,
    );
    if (!res.ok) return;
    const json = (await res.json()) as { exercises: Exercise[] };
    setBatch(json.exercises);
    setIndex(0);
  }, [props.q, mode]);

  const onResult = useCallback(
    async (correct: boolean) => {
      const ex = batch?.[index];
      if (!ex) return;
      const res = await fetch("/api/learn/answer", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          profileId: props.profileId,
          language: props.language,
          itemId: ex.itemId,
          correct,
          mode,
          today: localToday(),
          dailyGoalItems: props.goalItems,
        }),
      });
      if (res.ok) props.onProgress();
      const next = index + 1;
      if (batch && next >= batch.length) {
        setBatch(null);
        props.onSessionEnd();
      } else {
        setIndex(next);
      }
    },
    [batch, index, mode, props],
  );

  const requestHint = useCallback(
    async (itemId: string): Promise<Hint> => {
      const res = await fetch("/api/learn/hint", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          profileId: props.profileId,
          language: props.language,
          native: props.native,
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
    [props.profileId, props.language, props.native],
  );

  const current = batch?.[index] ?? null;

  return (
    <Stack gap="5">
      <Box>
        <Text textStyle="label" mb="2">
          Mode
        </Text>
        <HStack gap="1.5" flexWrap="wrap">
          {MODES.map((m) => (
            <Button
              key={m}
              size="xs"
              layerStyle={m === mode ? "inset" : "raised"}
              color={m === mode ? "accent.solid" : "fg.muted"}
              onClick={() => setMode(m)}
              disabled={batch !== null}
            >
              {PRACTICE_MODE_LABELS[m]}
            </Button>
          ))}
        </HStack>
      </Box>

      <Box layerStyle="tile" p="4" minH="180px">
        {current ? (
          <Stack gap="3">
            <Text textStyle="meta">
              {index + 1} / {batch?.length}
            </Text>
            <ExerciseView
              exercise={current}
              onResult={onResult}
              onRequestHint={requestHint}
              language={props.language}
              continueLabel={
                index + 1 >= (batch?.length ?? 0) ? "Finish" : "Next"
              }
            />
          </Stack>
        ) : props.items.length === 0 ? (
          <Text fontSize="sm" color="fg.muted">
            No vocabulary yet — import a CSV in the Stats tab.
          </Text>
        ) : (
          <Stack gap="3" align="center" justify="center" h="150px">
            <Text fontSize="sm" color="fg.muted">
              Ready for a {PRACTICE_MODE_LABELS[mode].toLowerCase()} session.
            </Text>
            <Button
              size="sm"
              bg="accent"
              color="accent.fg"
              _hover={{ bg: "accent.solid" }}
              onClick={start}
            >
              Start {SESSION_SIZE}-item session
            </Button>
          </Stack>
        )}
      </Box>

      <SentenceCoach
        profileId={props.profileId}
        language={props.language}
        native={props.native}
        items={props.items}
      />
    </Stack>
  );
}

function SentenceCoach(props: {
  profileId: string;
  language: string;
  native: string;
  items: VocabItem[];
}) {
  const phrases = useMemo(
    () =>
      props.items.filter(
        (i) => i.category === "phrase" || i.category === "noun",
      ),
    [props.items],
  );
  const [task, setTask] = useState<VocabItem | null>(null);
  const [answer, setAnswer] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = useCallback(() => {
    if (phrases.length === 0) return;
    const chosen = phrases[Math.floor(Math.random() * phrases.length)];
    if (!chosen) return;
    setTask(chosen);
    setAnswer("");
    setGrade(null);
    setError(null);
  }, [phrases]);

  const submit = useCallback(async () => {
    if (!task || !answer.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/learn/grade", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          profileId: props.profileId,
          language: props.language,
          native: props.native,
          prompt: `Say in ${props.language}: "${task.translation}"`,
          answer,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(
          json.error === "needs-connect"
            ? "Connect an Anthropic key in the Assistant widget to grade sentences."
            : String(json.error),
        );
        return;
      }
      setGrade(json as Grade);
    } finally {
      setLoading(false);
    }
  }, [task, answer, props]);

  return (
    <Box layerStyle="tile" p="4">
      <Text textStyle="label" mb="2">
        Write a sentence (graded by Claude)
      </Text>
      {task ? (
        <Stack gap="3">
          <Text fontSize="md" color="fg">
            Say in {props.language}:{" "}
            <chakra.span color="accent.solid">{task.translation}</chakra.span>
          </Text>
          <Input
            size="sm"
            placeholder={`your ${props.language} sentence…`}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && answer.trim() && !loading) void submit();
            }}
          />
          <HStack gap="2">
            <Button
              size="sm"
              bg="accent"
              color="accent.fg"
              _hover={{ bg: "accent.solid" }}
              loading={loading}
              disabled={!answer.trim()}
              onClick={submit}
            >
              Check
            </Button>
            <Button size="sm" variant="ghost" color="fg.muted" onClick={pick}>
              New prompt
            </Button>
          </HStack>
          {error ? (
            <Text fontSize="sm" color="danger">
              {error}
            </Text>
          ) : null}
          {grade ? (
            <Stack gap="1.5" layerStyle="inset" p="3">
              <Text fontSize="sm" color={grade.correct ? "success" : "fg"}>
                {grade.correct ? "Correct" : (grade.mainError ?? "Needs work")}
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
        </Stack>
      ) : (
        <Button
          size="sm"
          layerStyle="raised"
          color="fg"
          disabled={phrases.length === 0}
          onClick={pick}
        >
          {phrases.length === 0
            ? "Import vocabulary first"
            : "Give me a prompt"}
        </Button>
      )}
    </Box>
  );
}

// --- Browse -----------------------------------------------------------------

function BrowsePanel(props: {
  profileId: string;
  language: string;
  items: VocabItem[];
  onChange: () => Promise<void>;
}) {
  const [filter, setFilter] = useState<Category | "all">("all");
  const [term, setTerm] = useState("");
  const [translation, setTranslation] = useState("");
  const [category, setCategory] = useState<Category>("noun");

  const shown = props.items.filter(
    (i) => filter === "all" || i.category === filter,
  );

  const add = async () => {
    if (!term.trim() || !translation.trim()) return;
    await fetch("/api/learn/items", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        profileId: props.profileId,
        language: props.language,
        category,
        term,
        translation,
      }),
    });
    setTerm("");
    setTranslation("");
    await props.onChange();
  };

  const remove = async (id: string) => {
    await fetch(`/api/learn/items/${id}`, { method: "DELETE" });
    await props.onChange();
  };

  return (
    <Stack gap="4">
      <HStack gap="2" flexWrap="wrap">
        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Category | "all")}
        >
          <option value="all">all categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Text textStyle="meta">{shown.length} shown</Text>
      </HStack>

      <Box layerStyle="tile" p="3">
        <Text textStyle="label" mb="2">
          Add an item
        </Text>
        <Stack gap="2">
          <HStack gap="2">
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Input
              size="sm"
              placeholder={`${props.language} term`}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
            <Input
              size="sm"
              placeholder="translation"
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
            />
            <Button
              size="sm"
              bg="accent"
              color="accent.fg"
              _hover={{ bg: "accent.solid" }}
              disabled={!term.trim() || !translation.trim()}
              onClick={add}
            >
              Add
            </Button>
          </HStack>
        </Stack>
      </Box>

      <Stack gap="1.5">
        {shown.map((i) => {
          const acc = i.progress.seen
            ? Math.round((i.progress.correct / i.progress.seen) * 100)
            : null;
          return (
            <HStack
              key={i.id}
              gap="2"
              layerStyle="raised"
              px="3"
              py="2"
              align="center"
            >
              <SpeakButton text={i.term} language={props.language} size="2xs" />
              <Text fontSize="sm" color="fg" flex="1" minW="0">
                {i.term}
                <chakra.span color="fg.muted"> · {i.translation}</chakra.span>
              </Text>
              <Text textStyle="meta">{i.category}</Text>
              <Text textStyle="meta" minW="42px" textAlign="right">
                {acc === null ? "—" : `${acc}%`}
              </Text>
              <Button
                size="xs"
                variant="ghost"
                color="fg.faint"
                _hover={{ color: "danger" }}
                onClick={() => remove(i.id)}
                aria-label="Delete item"
              >
                ✕
              </Button>
            </HStack>
          );
        })}
      </Stack>
    </Stack>
  );
}

// --- Stats + import/export --------------------------------------------------

function StatsPanel(props: {
  q: string;
  profileId: string;
  language: string;
  native: string;
  items: VocabItem[];
  onImport: () => Promise<void>;
}) {
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const totalSeen = props.items.reduce((a, i) => a + i.progress.seen, 0);
  const totalCorrect = props.items.reduce((a, i) => a + i.progress.correct, 0);
  const overall = totalSeen ? Math.round((totalCorrect / totalSeen) * 100) : 0;
  const started = props.items.filter((i) => i.progress.seen > 0).length;

  const doImport = async () => {
    if (!csv.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/learn/import", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          profileId: props.profileId,
          language: props.language,
          nativeLanguage: props.native,
          csv,
        }),
      });
      const json = (await res.json()) as { imported: number; skipped: number };
      setMsg(
        `Imported ${json.imported}, skipped ${json.skipped} (already present).`,
      );
      setCsv("");
      await props.onImport();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack gap="5">
      <HStack gap="4" flexWrap="wrap">
        <Stat label="Items" value={String(props.items.length)} />
        <Stat label="Started" value={String(started)} />
        <Stat label="Overall accuracy" value={`${overall}%`} />
      </HStack>

      <Box layerStyle="tile" p="4">
        <Text textStyle="label" mb="2">
          Import CSV
        </Text>
        <Text textStyle="meta" mb="2">
          Columns: category,{props.language},{props.native},notes
          (comma-delimited).
        </Text>
        <Textarea
          size="sm"
          rows={5}
          placeholder="paste CSV…"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
        />
        <HStack gap="2" mt="2">
          <Button
            size="sm"
            bg="accent"
            color="accent.fg"
            _hover={{ bg: "accent.solid" }}
            loading={busy}
            disabled={!csv.trim()}
            onClick={doImport}
          >
            Import
          </Button>
          <Link
            href={`/api/learn/export?${props.q}&native=${encodeURIComponent(props.native)}`}
            color="link"
            fontSize="sm"
            _hover={{ color: "link.hover" }}
          >
            Export CSV →
          </Link>
        </HStack>
        {msg ? (
          <Text fontSize="sm" color="success" mt="2">
            {msg}
          </Text>
        ) : null}
      </Box>
    </Stack>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box layerStyle="raised" px="4" py="3" minW="120px">
      <Text textStyle="label">{label}</Text>
      <Text textStyle="data" fontSize="xl" color="fg">
        {value}
      </Text>
    </Box>
  );
}
