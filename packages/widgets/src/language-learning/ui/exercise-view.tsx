"use client";

import { useEffect, useState } from "react";
import { Box, Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { normalizeAnswer, type Exercise, type Hint } from "../types";
import { SpeakButton } from "./speak-button";

interface ExerciseViewProps {
  exercise: Exercise;
  /** Called once the learner has answered and chosen to continue. */
  onResult: (correct: boolean) => void;
  /** Label for the continue/advance action (e.g. "Next", "Finish"). */
  continueLabel?: string;
  /** Optional: fetch the LLM "+ more" hint. Omit to hide that button. */
  onRequestHint?: (itemId: string) => Promise<Hint>;
  /** Target language — enables 🔊 pronunciation buttons when provided. */
  language?: string;
}

export function ExerciseView({
  exercise,
  onResult,
  continueLabel = "Next",
  onRequestHint,
  language,
}: ExerciseViewProps) {
  const [fcChecked, setFcChecked] = useState(false); // flashcard answered/revealed
  const [fcMatched, setFcMatched] = useState(false); // flashcard typed exact match
  const [selected, setSelected] = useState<number | null>(null); // mc
  const [mcRevealed, setMcRevealed] = useState(false); // mc "solution"
  const [typed, setTyped] = useState(""); // cloze
  const [checked, setChecked] = useState(false); // cloze
  const [gaveUp, setGaveUp] = useState(false); // cloze "solution"

  const [hintOpen, setHintOpen] = useState(false);
  const [claudeHint, setClaudeHint] = useState<Hint | null>(null);
  const [claudeState, setClaudeState] = useState<
    "idle" | "loading" | "error" | "needs-connect"
  >("idle");

  // Reset all interaction + hint state whenever the exercise changes.
  useEffect(() => {
    setFcChecked(false);
    setFcMatched(false);
    setSelected(null);
    setMcRevealed(false);
    setTyped("");
    setChecked(false);
    setGaveUp(false);
    setHintOpen(false);
    setClaudeHint(null);
    setClaudeState("idle");
  }, [exercise]);

  const askClaude = async () => {
    if (!onRequestHint) return;
    setClaudeState("loading");
    try {
      setClaudeHint(await onRequestHint(exercise.itemId));
      setClaudeState("idle");
    } catch (err) {
      setClaudeState(
        (err as Error).message === "needs-connect" ? "needs-connect" : "error",
      );
    }
  };

  const hasOffline = Boolean(exercise.note || exercise.example);

  const hintBlock = hintOpen ? (
    <Stack gap="1.5" layerStyle="inset" p="3">
      {exercise.example ? (
        <HStack gap="1" align="center">
          <Text fontSize="sm" color="fg">
            {exercise.example}
          </Text>
          {language ? (
            <SpeakButton
              text={exercise.example}
              language={language}
              size="2xs"
            />
          ) : null}
        </HStack>
      ) : null}
      {exercise.note ? <Text textStyle="meta">{exercise.note}</Text> : null}
      {!hasOffline && claudeState === "idle" && !claudeHint ? (
        <Text textStyle="meta">No offline hint for this one.</Text>
      ) : null}
      {claudeHint ? (
        <Stack gap="0.5">
          <HStack gap="1" align="center">
            <Text fontSize="sm" color="fg">
              {claudeHint.example}
            </Text>
            {language ? (
              <SpeakButton
                text={claudeHint.example}
                language={language}
                size="2xs"
              />
            ) : null}
          </HStack>
          <Text textStyle="meta">{claudeHint.explanation}</Text>
        </Stack>
      ) : null}
      {claudeState === "needs-connect" ? (
        <Text fontSize="xs" color="fg.muted">
          Connect an Anthropic key (Assistant widget) for richer hints.
        </Text>
      ) : null}
      {claudeState === "error" ? (
        <Text fontSize="xs" color="danger">
          Couldn't fetch a hint.
        </Text>
      ) : null}
      {onRequestHint && !claudeHint ? (
        <Button
          size="xs"
          variant="ghost"
          color="link"
          alignSelf="flex-start"
          loading={claudeState === "loading"}
          _hover={{ color: "link.hover" }}
          onClick={askClaude}
        >
          + more from Claude
        </Button>
      ) : null}
    </Stack>
  ) : null;

  const helpBar = (showSolution: boolean, onSolution?: () => void) => (
    <HStack gap="3">
      <Button
        size="xs"
        variant="ghost"
        color="fg.muted"
        _hover={{ color: "fg" }}
        onClick={() => setHintOpen((v) => !v)}
      >
        {hintOpen ? "Hide hint" : "Hint"}
      </Button>
      {showSolution && onSolution ? (
        <Button
          size="xs"
          variant="ghost"
          color="fg.muted"
          _hover={{ color: "fg" }}
          onClick={onSolution}
        >
          Solution
        </Button>
      ) : null}
    </HStack>
  );

  if (exercise.kind === "flashcard") {
    const askForTerm = exercise.direction === "translation_to_term";
    const label = askForTerm
      ? "Type the word (or reveal)"
      : "Type the meaning (or reveal)";
    const check = () => {
      setFcMatched(normalizeAnswer(typed) === normalizeAnswer(exercise.answer));
      setFcChecked(true);
    };
    const promptIsTarget = exercise.direction === "term_to_translation";
    return (
      <Stack gap="3" w="100%">
        <Prompt
          hint={exercise.hint}
          speak={
            language && promptIsTarget
              ? { text: exercise.prompt, language }
              : undefined
          }
        >
          {exercise.prompt}
        </Prompt>
        {fcChecked ? (
          <Stack gap="3">
            <Box layerStyle="inset" px="3" py="2.5">
              <HStack gap="1" align="center">
                <Text fontSize="md" color="fg">
                  {exercise.answer}
                </Text>
                {language && !promptIsTarget ? (
                  <SpeakButton text={exercise.answer} language={language} />
                ) : null}
              </HStack>
            </Box>
            {fcMatched ? (
              <>
                <Text fontSize="sm" color="success">
                  ✓ Correct
                </Text>
                <Button
                  size="sm"
                  bg="accent"
                  color="accent.fg"
                  _hover={{ bg: "accent.solid" }}
                  onClick={() => onResult(true)}
                >
                  {continueLabel}
                </Button>
              </>
            ) : (
              <>
                {typed.trim() ? (
                  <Text textStyle="meta">you: {typed}</Text>
                ) : null}
                <HStack gap="2">
                  <Button
                    size="sm"
                    variant="ghost"
                    color="fg.muted"
                    _hover={{ color: "danger" }}
                    flex="1"
                    onClick={() => onResult(false)}
                  >
                    Missed
                  </Button>
                  <Button
                    size="sm"
                    bg="accent"
                    color="accent.fg"
                    _hover={{ bg: "accent.solid" }}
                    flex="1"
                    onClick={() => onResult(true)}
                  >
                    Got it
                  </Button>
                </HStack>
              </>
            )}
          </Stack>
        ) : (
          <Stack gap="2">
            <Text textStyle="label">{label}</Text>
            <Input
              size="sm"
              placeholder={askForTerm ? "word…" : "meaning…"}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && typed.trim()) check();
              }}
            />
            <HStack gap="2">
              <Button
                size="sm"
                bg="accent"
                color="accent.fg"
                _hover={{ bg: "accent.solid" }}
                disabled={!typed.trim()}
                onClick={check}
              >
                Check
              </Button>
              <Button
                size="sm"
                layerStyle="raised"
                color="fg"
                onClick={() => {
                  setFcMatched(false);
                  setFcChecked(true);
                }}
              >
                Show solution
              </Button>
            </HStack>
          </Stack>
        )}
        {helpBar(false)}
        {hintBlock}
      </Stack>
    );
  }

  if (exercise.kind === "multiple_choice") {
    const answered = selected !== null || mcRevealed;
    const mcCorrect = !mcRevealed && selected === exercise.answerIndex;
    return (
      <Stack gap="3" w="100%">
        <Prompt
          hint={exercise.hint}
          speak={language ? { text: exercise.prompt, language } : undefined}
        >
          {exercise.prompt}
        </Prompt>
        <Stack gap="2">
          {exercise.options.map((opt, i) => {
            const isAnswer = i === exercise.answerIndex;
            const isPicked = i === selected;
            let border = "transparent";
            if (answered && isAnswer) border = "var(--chakra-colors-success)";
            else if (answered && isPicked)
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
                onClick={() => setSelected(i)}
              >
                {opt}
              </Button>
            );
          })}
        </Stack>
        {answered ? (
          <Stack gap="2">
            <Text
              fontSize="sm"
              color={mcCorrect ? "success" : mcRevealed ? "fg" : "danger"}
            >
              {mcCorrect
                ? "✓ Correct"
                : `✗ ${exercise.options[exercise.answerIndex]}`}
            </Text>
            <Button
              size="sm"
              bg="accent"
              color="accent.fg"
              _hover={{ bg: "accent.solid" }}
              onClick={() => onResult(mcCorrect)}
            >
              {continueLabel}
            </Button>
          </Stack>
        ) : null}
        {helpBar(!answered, () => setMcRevealed(true))}
        {hintBlock}
      </Stack>
    );
  }

  // cloze
  const answered = checked || gaveUp;
  const correct =
    !gaveUp &&
    checked &&
    normalizeAnswer(typed) === normalizeAnswer(exercise.answer);
  return (
    <Stack gap="3" w="100%">
      <Prompt hint={exercise.hint}>{exercise.prompt}</Prompt>
      <Input
        size="sm"
        placeholder="fill the blank…"
        value={gaveUp ? exercise.answer : typed}
        disabled={answered}
        onChange={(e) => setTyped(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && typed.trim() && !answered) setChecked(true);
        }}
      />
      {answered ? (
        <Stack gap="2">
          <Text
            fontSize="sm"
            color={correct ? "success" : gaveUp ? "fg" : "danger"}
          >
            {correct
              ? "✓ Correct"
              : gaveUp
                ? `Answer: ${exercise.answer}`
                : `✗ ${exercise.answer}`}
          </Text>
          <HStack gap="1" align="center">
            <Text textStyle="meta">{exercise.full}</Text>
            {language ? (
              <SpeakButton
                text={exercise.full}
                language={language}
                size="2xs"
              />
            ) : null}
          </HStack>
          <Button
            size="sm"
            bg="accent"
            color="accent.fg"
            _hover={{ bg: "accent.solid" }}
            onClick={() => onResult(correct)}
          >
            {continueLabel}
          </Button>
        </Stack>
      ) : (
        <Button
          size="sm"
          layerStyle="raised"
          color="fg"
          disabled={!typed.trim()}
          onClick={() => setChecked(true)}
        >
          Check
        </Button>
      )}
      {helpBar(!answered, () => setGaveUp(true))}
      {hintBlock}
    </Stack>
  );
}

function Prompt({
  children,
  hint,
  speak,
}: {
  children: React.ReactNode;
  hint?: string;
  /** Target text to pronounce + its language. */
  speak?: { text: string; language: string };
}) {
  return (
    <Stack gap="1">
      <HStack gap="1" align="center">
        <Text fontSize="lg" color="fg" lineHeight="1.3">
          {children}
        </Text>
        {speak ? (
          <SpeakButton text={speak.text} language={speak.language} />
        ) : null}
      </HStack>
      {hint ? <Text textStyle="meta">{hint}</Text> : null}
    </Stack>
  );
}
