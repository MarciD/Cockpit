"use client";

import { useState, type FormEvent } from "react";
import { Button, HStack, Input, Stack, Text, chakra } from "@chakra-ui/react";
import { ACCENT_TOKENS, accentHex, monogram } from "@/lib/accent";
import { SegmentedControl } from "./segmented-control";

export interface Desk {
  id: string;
  name: string;
  kind: string;
  accent: string | null;
  monogram: string | null;
}

const LABEL_PROPS = {
  fontSize: "xs",
  fontWeight: "medium",
  color: "fg.muted",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} as const;

interface DeskFormProps {
  /** Undefined means "create a new desk". */
  desk?: Desk;
  onDone: () => void;
  onCancel: () => void;
}

/**
 * Create or edit a desk. Deleting is only offered when editing, and cascades
 * every widget, layout and to-do on that desk.
 */
export function DeskForm({ desk, onDone, onCancel }: DeskFormProps) {
  const [name, setName] = useState(desk?.name ?? "");
  const [kind, setKind] = useState(desk?.kind ?? "personal");
  const [accent, setAccent] = useState(desk?.accent ?? ACCENT_TOKENS[0]);
  const [mono, setMono] = useState(desk?.monogram ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    const body = JSON.stringify({
      name: trimmed,
      kind,
      accent,
      monogram: mono,
    });
    const res = await fetch(
      desk ? `/api/profiles/${desk.id}` : "/api/profiles",
      {
        method: desk ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body,
      },
    ).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError("Could not save the desk.");
      return;
    }
    onDone();
  }

  async function remove() {
    if (!desk || busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/profiles/${desk.id}`, {
      method: "DELETE",
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError("Could not delete the desk.");
      return;
    }
    onDone();
  }

  return (
    <chakra.form onSubmit={submit}>
      <Stack gap="4">
        <Stack gap="1.5">
          <Text {...LABEL_PROPS}>Name</Text>
          <Input
            size="sm"
            value={name}
            autoFocus
            maxLength={60}
            placeholder="Work, Studio, Personal…"
            onChange={(e) => setName(e.target.value)}
          />
        </Stack>

        <Stack gap="1.5">
          <Text {...LABEL_PROPS}>Kind</Text>
          <HStack>
            <SegmentedControl
              value={kind}
              onChange={setKind}
              ariaLabel="Desk kind"
              options={[
                { value: "personal", label: "Personal" },
                { value: "company", label: "Company" },
              ]}
            />
          </HStack>
        </Stack>

        <Stack gap="1.5">
          <Text {...LABEL_PROPS}>Accent</Text>
          <HStack gap="2">
            {ACCENT_TOKENS.map((token) => (
              <chakra.button
                key={token}
                type="button"
                aria-label={token}
                aria-pressed={token === accent}
                onClick={() => setAccent(token)}
                boxSize="26px"
                borderRadius="full"
                bg={accentHex(token)}
                cursor="pointer"
                borderWidth="2px"
                borderColor={token === accent ? "fg" : "transparent"}
                transition="border-color 0.15s ease"
              />
            ))}
          </HStack>
        </Stack>

        <Stack gap="1.5">
          <Text {...LABEL_PROPS}>Monogram (optional)</Text>
          <HStack gap="3">
            <Input
              size="sm"
              w="70px"
              maxLength={2}
              value={mono}
              placeholder={monogram(trimmed || "Desk")}
              onChange={(e) => setMono(e.target.value.toUpperCase())}
            />
            <Text fontSize="xs" color="fg.muted">
              Two letters for the rail. Defaults to the name&apos;s first two.
            </Text>
          </HStack>
        </Stack>

        {error ? (
          <Text fontSize="xs" color="danger">
            {error}
          </Text>
        ) : null}

        <HStack justify="space-between" pt="1">
          {desk ? (
            <chakra.button
              type="button"
              onClick={remove}
              fontSize="xs"
              color="danger"
              cursor="pointer"
              _hover={{ textDecoration: "underline" }}
            >
              Delete desk
            </chakra.button>
          ) : (
            <span />
          )}
          <HStack gap="2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              borderColor="border.strong"
              color="fg.muted"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!trimmed || busy}
              bg="accent"
              color="accent.fg"
              _hover={{ bg: "accent.solid" }}
            >
              {desk ? "Save" : "Create"}
            </Button>
          </HStack>
        </HStack>
      </Stack>
    </chakra.form>
  );
}
