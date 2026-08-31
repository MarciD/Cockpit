"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, HStack, Input, Stack, Text, chakra } from "@chakra-ui/react";
import type {
  WidgetConnectionField,
  WidgetDefinition,
} from "@cockpit/widget-sdk";

type FieldKind = "string" | "number" | "boolean" | "enum";
interface FieldDesc {
  key: string;
  label: string;
  kind: FieldKind;
  options?: string[];
}

/** Narrow shape of a Zod internal `_def` — enough to introspect fields. */
interface ZodDefLike {
  typeName?: string;
  innerType?: z.ZodTypeAny;
  values?: string[];
}

function unwrap(t: z.ZodTypeAny): z.ZodTypeAny {
  let cur = t;
  for (let i = 0; i < 6; i += 1) {
    const def = cur._def as ZodDefLike;
    if (
      def?.innerType &&
      (def.typeName === "ZodOptional" ||
        def.typeName === "ZodDefault" ||
        def.typeName === "ZodNullable")
    ) {
      cur = def.innerType;
    } else {
      break;
    }
  }
  return cur;
}

function labelize(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

/** Derive form fields from a widget's Zod object schema. */
function buildFields(schema: z.ZodType): FieldDesc[] {
  const shape = (schema as unknown as { shape?: Record<string, z.ZodTypeAny> })
    .shape;
  if (!shape) return [];
  return Object.entries(shape).map(([key, raw]) => {
    const inner = unwrap(raw);
    const typeName = (inner._def as ZodDefLike).typeName ?? "";
    if (typeName === "ZodBoolean")
      return { key, label: labelize(key), kind: "boolean" };
    if (typeName === "ZodNumber")
      return { key, label: labelize(key), kind: "number" };
    if (typeName === "ZodEnum") {
      return {
        key,
        label: labelize(key),
        kind: "enum",
        options: (inner._def as ZodDefLike).values ?? [],
      };
    }
    return { key, label: labelize(key), kind: "string" };
  });
}

const LABEL_PROPS = {
  fontSize: "xs",
  fontWeight: "medium",
  color: "fg.muted",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} as const;

export function WidgetConfigForm({
  def,
  config,
  onSave,
  onCancel,
}: {
  def: WidgetDefinition;
  config: unknown;
  onSave: (config: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const fields = buildFields(def.configSchema);
  const conn = def.connection;
  const { register, handleSubmit, formState } = useForm<
    Record<string, unknown>
  >({
    resolver: zodResolver(
      def.configSchema as z.ZodType<Record<string, unknown>>,
    ),
    defaultValues: {
      ...(def.defaultConfig as Record<string, unknown>),
      ...((config as Record<string, unknown> | null) ?? {}),
    },
  });

  // The connection is saved to the shared credential store (never in `config`).
  const [connValues, setConnValues] = useState<Record<string, string>>({});
  const [connStatus, setConnStatus] = useState<Record<string, unknown>>({});
  const connected = Boolean(connStatus.connected);

  useEffect(() => {
    if (!conn) return;
    fetch("/api/credentials")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && j[conn.provider]) {
          setConnStatus(j[conn.provider] as Record<string, unknown>);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn?.provider]);

  function fieldValue(f: WidgetConnectionField): string {
    if (connValues[f.key] !== undefined) return connValues[f.key];
    if (f.secret) return "";
    const s = connStatus[f.key];
    return typeof s === "string" ? s : (f.defaultValue ?? "");
  }

  async function saveConnection() {
    if (!conn) return;
    const payload: Record<string, string> = {};
    let complete = true;
    for (const f of conn.fields) {
      const v = fieldValue(f).trim();
      payload[f.key] = v;
      if (!v) complete = false;
    }
    // Only write when every field is present — secrets must be (re)entered.
    if (!complete) return;
    await fetch(`/api/credentials/${conn.provider}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async function disconnect() {
    if (!conn) return;
    await fetch(`/api/credentials/${conn.provider}`, { method: "DELETE" });
    setConnStatus({});
    setConnValues({});
  }

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        await saveConnection();
        onSave(values);
      })}
    >
      <Stack gap="4">
        {fields.map((field) => (
          <Stack key={field.key} gap="1.5">
            <Text {...LABEL_PROPS}>{field.label}</Text>
            {field.kind === "boolean" ? (
              <input
                type="checkbox"
                {...register(field.key)}
                style={{
                  width: 16,
                  height: 16,
                  accentColor: "var(--accent)",
                  cursor: "pointer",
                }}
              />
            ) : field.kind === "number" ? (
              <Input
                size="sm"
                type="number"
                {...register(field.key, { valueAsNumber: true })}
              />
            ) : field.kind === "enum" && field.options ? (
              <chakra.select
                {...register(field.key)}
                borderWidth="1px"
                borderColor="border.strong"
                borderRadius="small"
                bg="bg.panel"
                color="fg"
                px="2"
                py="1.5"
                fontSize="sm"
              >
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </chakra.select>
            ) : (
              <Input size="sm" {...register(field.key)} />
            )}
            {formState.errors[field.key] ? (
              <Text fontSize="xs" color="danger">
                {String(formState.errors[field.key]?.message ?? "Invalid")}
              </Text>
            ) : null}
          </Stack>
        ))}

        {conn ? (
          <Stack gap="4" pt="1">
            <HStack justify="space-between">
              <Text {...LABEL_PROPS}>{conn.label} connection</Text>
              {connected ? (
                <HStack gap="3">
                  <Text
                    fontFamily="mono"
                    fontSize="2xs"
                    letterSpacing="0.1em"
                    textTransform="uppercase"
                    color="success"
                  >
                    ● Connected
                  </Text>
                  <chakra.button
                    type="button"
                    onClick={disconnect}
                    fontSize="xs"
                    color="danger"
                    cursor="pointer"
                    _hover={{ textDecoration: "underline" }}
                  >
                    Disconnect
                  </chakra.button>
                </HStack>
              ) : (
                <Text
                  fontFamily="mono"
                  fontSize="2xs"
                  letterSpacing="0.1em"
                  textTransform="uppercase"
                  color="fg.faint"
                >
                  ○ Not connected
                </Text>
              )}
            </HStack>
            {conn.fields.map((f) => (
              <Stack key={f.key} gap="1.5">
                <Text {...LABEL_PROPS}>{f.label}</Text>
                <Input
                  size="sm"
                  type={f.secret ? "password" : "text"}
                  placeholder={
                    f.secret && connected
                      ? "•••••••• (saved — re-enter to update)"
                      : f.placeholder
                  }
                  value={fieldValue(f)}
                  onChange={(e) =>
                    setConnValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                />
              </Stack>
            ))}
            <Text fontSize="xs" color="fg.faint">
              Stored securely on the server — never sent to the browser.
            </Text>
          </Stack>
        ) : null}

        <HStack justify="flex-end" gap="2" pt="1">
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
            bg="accent"
            color="accent.fg"
            _hover={{ bg: "accent.solid" }}
          >
            Save
          </Button>
        </HStack>
      </Stack>
    </form>
  );
}
