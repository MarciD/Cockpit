"use client";

import { useEffect, useState } from "react";
import { Box, Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { SpeakButton } from "./speak-button";
import { normalizeAnswer, type Grade, type SentenceTask } from "../types";

const JSON_HEADERS = { "content-type": "application/json" };

interface SentenceTaskViewProps {
  task: SentenceTask;
  language: string;
  native: string;
  profileId: string;
  onDone: () => void;
}

export function SentenceTaskView(props: SentenceTaskViewProps) {
  const { task } = props;

  // reorder
  const [chosen, setChosen] = useState<number[]>([]);
  // cloze
  const [typed, setTyped] = useState("");
  const [checked, setChecked] = useState(false);
  // produce
  const [sentence, setSentence] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [grading, setGrading] = useState(false);

  useEffect(() => {
    setChosen([]);
    setTyped("");
    setChecked(false);
    setSentence("");
    setGrade(null);
  }, [task]);

  if (task.kind === "reorder") {
    const remaining = task.tokens
      .map((tok, i) => ({ tok, i }))
      .filter(({ i }) => !chosen.includes(i));
    const assembled = chosen.map((i) => task.tokens[i]).join(" ");
    const complete = chosen.length === task.tokens.length;
    const correct =
      complete && normalizeAnswer(assembled) === normalizeAnswer(task.answer);
    return (
      <Stack gap="3">
        <Text textStyle="label">Put the words in order</Text>
        <Text fontSize="sm" color="fg.muted">
          {task.native}
        </Text>
        <Box layerStyle="inset" p="3" minH="44px">
          <HStack gap="2" flexWrap="wrap">
            {chosen.map((i, pos) => (
              <Button
                key={`${i}-${pos}`}
                size="xs"
                layerStyle="raised"
                color="fg"
                onClick={() =>
                  !checked && setChosen((c) => c.filter((_, p) => p !== pos))
                }
              >
                {task.tokens[i]}
              </Button>
            ))}
            {chosen.length === 0 ? (
              <Text textStyle="meta">tap words below…</Text>
            ) : null}
          </HStack>
        </Box>
        <HStack gap="2" flexWrap="wrap">
          {remaining.map(({ tok, i }) => (
            <Button
              key={i}
              size="xs"
              layerStyle="raised"
              color="fg"
              disabled={checked}
              onClick={() => setChosen((c) => [...c, i])}
            >
              {tok}
            </Button>
          ))}
        </HStack>
        {checked ? (
          <Stack gap="2">
            <HStack gap="1" align="center">
              <Text fontSize="sm" color={correct ? "success" : "danger"}>
                {correct ? "✓ Correct" : `✗ ${task.answer}`}
              </Text>
              <SpeakButton
                text={task.answer}
                language={props.language}
                size="2xs"
              />
            </HStack>
            <Button
              size="sm"
              bg="accent"
              color="accent.fg"
              _hover={{ bg: "accent.solid" }}
              onClick={props.onDone}
            >
              Next
            </Button>
          </Stack>
        ) : (
          <Button
            size="sm"
            layerStyle="raised"
            color="fg"
            disabled={!complete}
            onClick={() => setChecked(true)}
          >
            Check
          </Button>
        )}
      </Stack>
    );
  }

  if (task.kind === "sentence_cloze") {
    const correct =
      checked && normalizeAnswer(typed) === normalizeAnswer(task.answer);
    return (
      <Stack gap="3">
        <Text textStyle="label">Fill the blank</Text>
        <Text fontSize="sm" color="fg.muted">
          {task.native}
        </Text>
        <Text fontSize="lg" color="fg">
          {task.prompt}
        </Text>
        <Input
          size="sm"
          placeholder="the missing word…"
          value={typed}
          disabled={checked}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && typed.trim() && !checked) setChecked(true);
          }}
        />
        {checked ? (
          <Stack gap="2">
            <HStack gap="1" align="center">
              <Text fontSize="sm" color={correct ? "success" : "danger"}>
                {correct ? "✓ Correct" : `✗ ${task.answer}`}
              </Text>
              <SpeakButton
                text={task.full}
                language={props.language}
                size="2xs"
              />
            </HStack>
            <Text textStyle="meta">{task.full}</Text>
            <Button
              size="sm"
              bg="accent"
              color="accent.fg"
              _hover={{ bg: "accent.solid" }}
              onClick={props.onDone}
            >
              Next
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
      </Stack>
    );
  }

  // produce
  return (
    <Stack gap="3">
      <Text textStyle="label">Say it yourself</Text>
      <Text fontSize="md" color="fg">
        {task.native}
      </Text>
      {task.chunks.length > 0 ? (
        <Text textStyle="meta">try using: {task.chunks.join(" · ")}</Text>
      ) : null}
      <Input
        size="sm"
        placeholder={`your ${props.language} sentence…`}
        value={sentence}
        onChange={(e) => setSentence(e.target.value)}
      />
      {grade ? (
        <Stack gap="1" layerStyle="inset" p="3">
          <HStack gap="1" align="center">
            <Text fontSize="sm" color={grade.correct ? "success" : "fg"}>
              {grade.correct
                ? "✓ Looks good"
                : (grade.mainError ?? "Review it")}
            </Text>
            <SpeakButton
              text={task.target}
              language={props.language}
              size="2xs"
            />
          </HStack>
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
      <HStack gap="2">
        {grade ? (
          <Button
            size="sm"
            bg="accent"
            color="accent.fg"
            _hover={{ bg: "accent.solid" }}
            onClick={props.onDone}
          >
            Next
          </Button>
        ) : (
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
                const res = await fetch("/api/learn/grade", {
                  method: "POST",
                  headers: JSON_HEADERS,
                  body: JSON.stringify({
                    profileId: props.profileId,
                    language: props.language,
                    native: props.native,
                    prompt: `Say in ${props.language}: "${task.native}"`,
                    answer: sentence,
                  }),
                });
                const json = await res.json();
                if (res.ok) setGrade(json as Grade);
                else
                  setGrade({
                    correct: false,
                    mainError:
                      json.error === "needs-connect"
                        ? "Connect an Anthropic key to grade."
                        : String(json.error),
                    warnings: [],
                    corrected: null,
                  });
              } finally {
                setGrading(false);
              }
            }}
          >
            Check
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          color="fg.muted"
          onClick={props.onDone}
        >
          Skip
        </Button>
      </HStack>
    </Stack>
  );
}
