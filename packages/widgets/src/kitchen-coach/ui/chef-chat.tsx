"use client";

import { useCallback, useRef, useState } from "react";
import { Box, Flex, Input, Stack, Text, chakra } from "@chakra-ui/react";
import type { RecipeDto } from "../types";
import { API, JSON_HEADERS } from "./lib";

interface ChefChatProps {
  profileId: string;
  recipe: RecipeDto | null;
  tone: string;
  language: "de" | "en";
  model: string;
  onClose: () => void;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const GREETING =
  "Frag. Zutat ersetzen, Technik, warum das eben schiefging — ich beiße nur verbal.";

/** One chat, optionally about the recipe on screen. Streamed, not persisted. */
export function ChefChat({
  profileId,
  recipe,
  tone,
  language,
  model,
  onClose,
}: ChefChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    { id: "seed", role: "assistant", content: GREETING },
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || busy) return;
    const outgoing = messages
      .filter((m) => m.id !== "seed")
      .map((m) => ({ role: m.role, content: m.content }));
    outgoing.push({ role: "user", content: text });

    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: text },
      { id: "pending", role: "assistant", content: "" },
    ]);
    setDraft("");
    setBusy(true);
    abort.current?.abort();
    abort.current = new AbortController();

    try {
      const res = await fetch(`${API}/coach`, {
        method: "POST",
        headers: JSON_HEADERS,
        signal: abort.current.signal,
        body: JSON.stringify({
          profileId,
          recipe,
          messages: outgoing,
          tone,
          language,
          model,
        }),
      });
      if (!res.ok || !res.body) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          json.error === "needs-connect"
            ? "Erst einen Anthropic-Key verbinden."
            : "Der Chef antwortet gerade nicht.",
        );
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text_ = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        text_ += decoder.decode(value, { stream: true });
        setMessages((current) =>
          current.map((m) =>
            m.id === "pending" ? { ...m, content: text_ } : m,
          ),
        );
      }
      setMessages((current) =>
        current.map((m) =>
          m.id === "pending" ? { ...m, id: crypto.randomUUID() } : m,
        ),
      );
    } catch (err) {
      const message = (err as Error).message;
      setMessages((current) =>
        current.map((m) =>
          m.id === "pending" ? { ...m, id: "err", content: message } : m,
        ),
      );
    } finally {
      setBusy(false);
    }
  }, [draft, busy, messages, profileId, recipe, tone, language, model]);

  return (
    <Stack gap="2.5" h="100%">
      <Flex justify="space-between" align="center">
        <Text textStyle="label">frag den chef</Text>
        <chakra.button
          type="button"
          onClick={onClose}
          textStyle="label"
          color="link"
          cursor="pointer"
        >
          schließen
        </chakra.button>
      </Flex>

      <Stack gap="2" flex="1" minH="0" overflowY="auto">
        {messages.map((m) => (
          <Box
            key={m.id}
            alignSelf={m.role === "user" ? "flex-end" : "flex-start"}
            maxW="85%"
            px="3"
            py="2"
            borderRadius="13px"
            bg={m.role === "user" ? "accent.solid" : "bg.subtle"}
            color={m.role === "user" ? "accent.fg" : "fg"}
          >
            <Text fontSize="13px" lineHeight="1.45" whiteSpace="pre-wrap">
              {m.content || "…"}
            </Text>
          </Box>
        ))}
      </Stack>

      <Flex
        layerStyle="inset"
        borderRadius="control"
        px="3.5"
        py="2"
        gap="2"
        align="center"
      >
        <Input
          variant="subtle"
          bg="transparent"
          border="none"
          px="0"
          h="auto"
          fontSize="13px"
          placeholder="Kann ich Schenkel durch Brust ersetzen?"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send();
          }}
          _focusVisible={{ outline: "none" }}
          aria-label="Frage an den Chef"
        />
        <chakra.button
          type="button"
          aria-label="Senden"
          onClick={() => void send()}
          color="link"
          cursor="pointer"
        >
          ↑
        </chakra.button>
      </Flex>
    </Stack>
  );
}
