"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Flex, Heading, Input, Stack, Text } from "@chakra-ui/react";

interface LoginFormProps {
  next: string;
}

/** Single-field unlock for the shared-token gate. */
export function LoginForm({ next }: LoginFormProps) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token.trim() || busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: token.trim() }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError("That token doesn't match.");
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <Flex minH="100dvh" align="center" justify="center" px="6">
      <Stack
        as="form"
        onSubmit={submit}
        gap="5"
        w="100%"
        maxW="340px"
        p="8"
        layerStyle="tile"
        borderRadius="dialog"
      >
        <Stack gap="1.5">
          <Flex align="baseline" gap="1.5">
            <Text fontFamily="mono" fontSize="xl" color="accent" lineHeight="1">
              ▍
            </Text>
            <Heading size="lg" letterSpacing="-0.02em">
              cockpit
            </Heading>
          </Flex>
          <Text color="fg.muted" fontSize="sm">
            Enter the access token.
          </Text>
        </Stack>

        <Input
          size="sm"
          type="password"
          value={token}
          autoFocus
          autoComplete="current-password"
          placeholder="COCKPIT_ACCESS_TOKEN"
          onChange={(e) => setToken(e.target.value)}
        />

        {error ? (
          <Text fontSize="xs" color="danger">
            {error}
          </Text>
        ) : null}

        <Button
          type="submit"
          size="sm"
          disabled={!token.trim() || busy}
          bg="accent"
          color="accent.fg"
          _hover={{ bg: "accent.solid" }}
        >
          Unlock
        </Button>
      </Stack>
    </Flex>
  );
}
