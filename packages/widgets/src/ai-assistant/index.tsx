"use client";

// NOTE: widget config is client-visible — it holds ONLY non-secret prefs. The
// Anthropic API key lives server-side in the CredentialStore and is read only
// by the /api/assistant route; it must never appear in this config.

import { useEffect, useRef, useState } from "react";
import { Box, HStack, Stack, chakra } from "@chakra-ui/react";
import {
  defineWidget,
  type WidgetComponentProps,
  type WidgetContextPayload,
} from "@cockpit/widget-sdk";
import { useSignals } from "@cockpit/widget-sdk/signals";
import { ConnectPrompt } from "../lib/connect";
import {
  configSchema,
  defaultConfig,
  type AssistantConfig as Config,
} from "./config";

interface Data {
  profileId: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const GREETING: ChatMessage = {
  id: "seed",
  role: "assistant",
  content:
    "Ask me about your day — priorities, MRs, Jira, meetings, weather. I read what's on this desk and can pull live detail.",
};

function Panel({
  config,
  data,
  onOpenSettings,
}: WidgetComponentProps<Config, Data>) {
  const signals = useSignals();
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsConnect, setNeedsConnect] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const counter = useRef(0);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // Abort an in-flight stream if the tile is removed mid-answer.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    counter.current += 1;
    const n = counter.current;
    const userMsg: ChatMessage = { id: `u${n}`, role: "user", content: text };
    const assistantId = `a${n}`;
    const history = [...messages, userMsg].filter((m) => m.id !== "seed");
    setMessages((m) => [
      ...m,
      userMsg,
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setInput("");
    setBusy(true);

    const context = config.useDeskContext
      ? signals
          .filter((s) => s.type === "widget:context")
          .map((s) => s.payload as WidgetContextPayload)
      : [];

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/w/ai-assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          profileId: data.profileId,
          context,
          model: config.model,
          systemNote: config.systemNote,
        }),
        signal: controller.signal,
      });
      if (res.status === 400) {
        const j = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (j?.error === "needs-connect") {
          setNeedsConnect(true);
          return;
        }
      }
      if (!res.ok || !res.body) {
        throw new Error(`Request failed (HTTP ${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: msg.content + chunk }
              : msg,
          ),
        );
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const message = (err as Error).message;
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId && !msg.content
              ? { ...msg, content: `Sorry — ${message}` }
              : msg,
          ),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  function clearChat() {
    abortRef.current?.abort();
    setBusy(false);
    setInput("");
    setMessages([GREETING]);
  }

  if (needsConnect)
    return <ConnectPrompt label="Claude" onConnect={onOpenSettings} />;

  return (
    <Stack gap="3" h="100%" w="100%">
      {messages.length > 1 ? (
        <HStack justify="flex-end" flexShrink={0}>
          <chakra.button
            type="button"
            onClick={clearChat}
            fontFamily="mono"
            fontSize="2xs"
            letterSpacing="0.1em"
            textTransform="uppercase"
            color="fg.faint"
            cursor="pointer"
            _hover={{ color: "fg.muted" }}
          >
            Clear
          </chakra.button>
        </HStack>
      ) : null}
      <Stack
        ref={scrollRef}
        gap="2.5"
        flex="1"
        overflowY="auto"
        pr="1"
        minH="0"
      >
        {messages.map((m) => (
          <Box
            key={m.id}
            alignSelf={m.role === "user" ? "flex-end" : "flex-start"}
            maxW="88%"
            px="12px"
            py="9px"
            borderRadius="12px"
            borderBottomRightRadius={m.role === "user" ? "4px" : "12px"}
            borderBottomLeftRadius={m.role === "assistant" ? "4px" : "12px"}
            fontSize="13px"
            lineHeight="1.45"
            whiteSpace="pre-wrap"
            bg={m.role === "user" ? "#1a1a18" : "bg.subtle"}
            color={m.role === "user" ? "#fff" : "fg"}
          >
            {m.content || (busy ? "…" : "")}
          </Box>
        ))}
      </Stack>

      <HStack
        layerStyle="inset"
        borderRadius="control"
        px="12px"
        py="9px"
        gap="2"
        flexShrink={0}
      >
        <chakra.input
          flex="1"
          minW="0"
          fontSize="13px"
          color="fg"
          bg="transparent"
          border="0"
          outline="none"
          placeholder="Ask anything…"
          _placeholder={{ color: "fg.faint" }}
          value={input}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send();
          }}
        />
        <chakra.button
          type="button"
          aria-label="Send"
          onClick={() => void send()}
          boxSize="26px"
          borderRadius="full"
          bg="accent.solid"
          color="accent.fg"
          fontSize="16px"
          lineHeight="1"
          cursor="pointer"
          flexShrink={0}
          opacity={busy ? 0.5 : 1}
        >
          ↑
        </chakra.button>
      </HStack>
    </Stack>
  );
}

const aiAssistantWidget = defineWidget<Config, Data>({
  id: "ai-assistant",
  title: "Assistant",
  description:
    "Ask Claude about your desk — priorities, MRs, meetings, weather.",
  icon: () => <span aria-hidden>✳</span>,
  category: "ai",
  configSchema,
  defaultConfig,
  connection: {
    provider: "anthropic",
    label: "Claude",
    fields: [
      {
        key: "apiKey",
        label: "Anthropic API key",
        secret: true,
        placeholder: "sk-ant-…",
      },
    ],
  },
  layout: { defaultW: 4, defaultH: 8, minW: 3, minH: 5, mobileH: 11 },
  data: {
    queryKey: (_config, profileId) => ["ai-assistant", profileId],
    queryFn: async (ctx) => ({ profileId: ctx.profileId }),
    staleTimeMs: Infinity,
    // No external fetch to refresh — the connection is only for the API key.
    manualRefresh: false,
  },
  Component: Panel,
});

export default aiAssistantWidget;
