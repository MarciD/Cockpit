"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Input,
  Stack,
  Text,
  chakra,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ChannelId,
  DeliveryOutcomeDto,
  PreferencesViewDto,
} from "@/lib/notifications/dto-client";
import { Modal } from "../modal";
import { NOTIFICATIONS_QUERY_KEY } from "./use-notifications";

interface NotificationSettingsProps {
  open: boolean;
  onClose: () => void;
}

const PREFERENCES_KEY = ["notification-preferences"] as const;
const PHONE_KEY = ["notification-phone"] as const;
const JSON_HEADERS = { "content-type": "application/json" };
const DEFAULT_KIND = "*";
const DEFAULT_QUIET = { from: "23:00", to: "07:00" };
const NTFY_DEFAULT_URL = "https://ntfy.sh";

interface PhoneStatus {
  connected: boolean;
  baseUrl: string | null;
  topic: string | null;
  hasToken: boolean;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})`);
  return (await res.json()) as T;
}

/** A topic is the only secret on ntfy.sh, so suggest one nobody guesses. */
function randomTopic(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `cockpit-${Array.from(bytes, (b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 18)}`;
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CheckCell({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <chakra.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      boxSize="16px"
      borderRadius="checkbox"
      layerStyle={checked ? undefined : "inset"}
      bg={checked ? "accent" : undefined}
      boxShadow={checked ? "raisedSm" : undefined}
      color="accent.fg"
      fontSize="10px"
      lineHeight="1"
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      cursor="pointer"
    >
      {checked ? "✓" : ""}
    </chakra.button>
  );
}

export function NotificationSettings({
  open,
  onClose,
}: NotificationSettingsProps) {
  const queryClient = useQueryClient();
  const view = useQuery({
    queryKey: PREFERENCES_KEY,
    queryFn: () =>
      getJson<PreferencesViewDto>("/api/notifications/preferences"),
    enabled: open,
  });
  const phone = useQuery({
    queryKey: PHONE_KEY,
    queryFn: () => getJson<PhoneStatus>("/api/notifications/phone"),
    enabled: open,
  });

  const [byKind, setByKind] = useState<Record<string, ChannelId[]>>({});
  const [quietOn, setQuietOn] = useState(false);
  const [quiet, setQuiet] = useState(DEFAULT_QUIET);
  const [publicUrl, setPublicUrl] = useState("");
  const [ntfy, setNtfy] = useState({
    baseUrl: NTFY_DEFAULT_URL,
    topic: "",
    token: "",
  });
  const [ntfyDirty, setNtfyDirty] = useState(false);
  const [testResult, setTestResult] = useState<
    DeliveryOutcomeDto[] | string | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed the editable copies once the view arrives (and again on reopen).
  useEffect(() => {
    if (!view.data) return;
    setByKind(view.data.byKind);
    setQuietOn(Boolean(view.data.quiet));
    setQuiet(view.data.quiet ?? DEFAULT_QUIET);
    setPublicUrl(view.data.publicUrl ?? "");
  }, [view.data]);
  useEffect(() => {
    const saved = phone.data;
    if (!saved) return;
    setNtfy({
      baseUrl: saved.baseUrl || NTFY_DEFAULT_URL,
      topic: saved.topic ?? "",
      token: "",
    });
    setNtfyDirty(false);
  }, [phone.data]);

  const kinds = view.data?.kinds ?? [];
  const channels = view.data?.channels ?? [];
  const ntfyConnected = Boolean(phone.data?.connected);

  function toggle(kind: string, channel: ChannelId) {
    setByKind((current) => {
      const row = current[kind] ?? current[DEFAULT_KIND] ?? [];
      const next = row.includes(channel)
        ? row.filter((c) => c !== channel)
        : [...row, channel];
      return { ...current, [kind]: next };
    });
  }

  async function invalidate() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: PREFERENCES_KEY }),
      queryClient.invalidateQueries({ queryKey: PHONE_KEY }),
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }),
    ]);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          byKind,
          quiet: quietOn ? quiet : null,
          publicUrl: publicUrl.trim() || null,
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? `Request failed (HTTP ${res.status})`);
      }
      if (ntfyDirty && ntfy.baseUrl.trim() && ntfy.topic.trim()) {
        const saved = await fetch("/api/notifications/phone", {
          method: "PUT",
          headers: JSON_HEADERS,
          body: JSON.stringify({
            baseUrl: ntfy.baseUrl.trim(),
            topic: ntfy.topic.trim(),
            token: ntfy.token.trim(),
          }),
        });
        if (!saved.ok) {
          const json = (await saved.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(
            json.error ??
              `Saving the phone connection failed (HTTP ${saved.status})`,
          );
        }
      }
      await invalidate();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function disconnectPhone() {
    await fetch("/api/notifications/phone", { method: "DELETE" });
    setNtfy({ baseUrl: NTFY_DEFAULT_URL, topic: "", token: "" });
    setNtfyDirty(false);
    await invalidate();
  }

  async function sendTest(delayMs = 0) {
    setTestResult(null);
    const res = await fetch("/api/notifications/test", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ delayMs }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      deliveries?: DeliveryOutcomeDto[];
      scheduled?: string;
      error?: string;
    };
    if (json.deliveries) setTestResult(json.deliveries);
    else if (json.scheduled)
      setTestResult(
        `Scheduled — arrives in about ${Math.round(delayMs / 1000)} s.`,
      );
    else setTestResult(json.error ?? "The test could not be sent.");
    await invalidate();
  }

  return (
    <Modal open={open} onClose={onClose} title="Notifications">
      {view.isPending ? (
        <Text fontSize="sm" color="fg.muted">
          Loading…
        </Text>
      ) : view.isError ? (
        <Text fontSize="sm" color="danger">
          Couldn’t load the settings.
        </Text>
      ) : (
        <Stack gap="6">
          {/* kind × channel matrix */}
          <Box>
            <Text textStyle="label" mb="2">
              what goes where
            </Text>
            <Text fontSize="xs" color="fg.muted" mb="3">
              Everything lands in the inbox. Tick where a kind should also go.
            </Text>
            <Box
              as="table"
              w="100%"
              fontSize="sm"
              css={{ borderCollapse: "collapse" }}
            >
              <thead>
                <tr>
                  <Box as="th" textAlign="left" pb="2" fontWeight="normal">
                    <Text textStyle="label">kind</Text>
                  </Box>
                  {channels.map((c) => (
                    <Box
                      as="th"
                      key={c.id}
                      textAlign="center"
                      pb="2"
                      fontWeight="normal"
                      px="2"
                    >
                      <Text textStyle="label">{c.id}</Text>
                    </Box>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { kind: DEFAULT_KIND, label: "Everything else" },
                  ...kinds,
                ].map((row) => {
                  const current =
                    byKind[row.kind] ?? byKind[DEFAULT_KIND] ?? [];
                  return (
                    <Box
                      as="tr"
                      key={row.kind}
                      borderTopWidth="1px"
                      borderColor="border"
                    >
                      <Box as="td" py="2">
                        <Text fontSize="sm">{row.label}</Text>
                        {row.kind !== DEFAULT_KIND ? (
                          <Text textStyle="meta">{row.kind}</Text>
                        ) : null}
                      </Box>
                      {channels.map((c) => (
                        <Box
                          as="td"
                          key={c.id}
                          textAlign="center"
                          py="2"
                          px="2"
                        >
                          <CheckCell
                            checked={current.includes(c.id)}
                            label={`${row.label} via ${c.label}`}
                            onToggle={() => toggle(row.kind, c.id)}
                          />
                        </Box>
                      ))}
                    </Box>
                  );
                })}
              </tbody>
            </Box>
          </Box>

          {/* quiet hours + public URL */}
          <Flex gap="4" wrap="wrap">
            <Box flex="1" minW="200px">
              <Flex align="center" gap="2" mb="2">
                <CheckCell
                  checked={quietOn}
                  label="Quiet hours"
                  onToggle={() => setQuietOn((v) => !v)}
                />
                <Text textStyle="label">quiet hours</Text>
                {view.data?.quietNow ? (
                  <Text textStyle="meta">· active now</Text>
                ) : null}
              </Flex>
              <Flex gap="2" align="center" opacity={quietOn ? 1 : 0.5}>
                <Input
                  type="time"
                  size="sm"
                  value={quiet.from}
                  disabled={!quietOn}
                  onChange={(e) =>
                    setQuiet((q) => ({ ...q, from: e.target.value }))
                  }
                  aria-label="Quiet from"
                />
                <Text textStyle="meta">to</Text>
                <Input
                  type="time"
                  size="sm"
                  value={quiet.to}
                  disabled={!quietOn}
                  onChange={(e) =>
                    setQuiet((q) => ({ ...q, to: e.target.value }))
                  }
                  aria-label="Quiet until"
                />
              </Flex>
              <Text fontSize="xs" color="fg.muted" mt="2">
                Desktop and phone stay silent; the inbox still fills.
              </Text>
            </Box>
            <Box flex="1" minW="200px">
              <Text textStyle="label" mb="2">
                cockpit’s address for the phone
              </Text>
              <Input
                size="sm"
                placeholder="https://your-mac.tailnet.ts.net"
                value={publicUrl}
                onChange={(e) => setPublicUrl(e.target.value)}
                aria-label="Public URL"
              />
              <Text fontSize="xs" color="fg.muted" mt="2">
                Where a tap on the phone should open. Leave empty for messages
                without a link.
              </Text>
            </Box>
          </Flex>

          {/* channels */}
          <Flex gap="4" wrap="wrap">
            {channels.map((c) => (
              <Box
                key={c.id}
                flex="1"
                minW="220px"
                layerStyle="inset"
                p="3"
                borderRadius="small"
              >
                <Flex justify="space-between" align="baseline" mb="1">
                  <Text fontSize="sm" fontWeight="semibold">
                    {c.label}
                  </Text>
                  <Text
                    textStyle="meta"
                    color={c.availability.ok ? "success" : "fg.muted"}
                  >
                    {c.availability.ok ? "● ready" : "○ not ready"}
                  </Text>
                </Flex>
                <Text fontSize="xs" color="fg.muted">
                  {c.availability.detail}
                </Text>
                {c.lastDelivery ? (
                  <Text textStyle="meta" mt="1">
                    last {c.lastDelivery.status} {timeLabel(c.lastDelivery.at)}
                    {c.lastDelivery.detail ? ` · ${c.lastDelivery.detail}` : ""}
                  </Text>
                ) : null}

                {c.id === "phone" ? (
                  <Stack gap="2" mt="3">
                    <Input
                      size="sm"
                      placeholder="https://ntfy.sh"
                      value={ntfy.baseUrl}
                      onChange={(e) => {
                        setNtfy((n) => ({ ...n, baseUrl: e.target.value }));
                        setNtfyDirty(true);
                      }}
                      aria-label="ntfy server URL"
                    />
                    <Flex gap="2">
                      <Input
                        size="sm"
                        placeholder="topic"
                        value={ntfy.topic}
                        onChange={(e) => {
                          setNtfy((n) => ({ ...n, topic: e.target.value }));
                          setNtfyDirty(true);
                        }}
                        aria-label="ntfy topic"
                      />
                      <Button
                        size="sm"
                        layerStyle="raised"
                        color="fg"
                        flexShrink={0}
                        onClick={() => {
                          setNtfy((n) => ({ ...n, topic: randomTopic() }));
                          setNtfyDirty(true);
                        }}
                      >
                        Suggest
                      </Button>
                    </Flex>
                    <Input
                      size="sm"
                      type="password"
                      placeholder={
                        phone.data?.hasToken
                          ? "token saved — leave empty to keep it"
                          : "access token (optional)"
                      }
                      value={ntfy.token}
                      onChange={(e) => {
                        setNtfy((n) => ({ ...n, token: e.target.value }));
                        setNtfyDirty(true);
                      }}
                      aria-label="ntfy access token"
                    />
                    <Flex justify="space-between" align="center">
                      <Text fontSize="xs" color="fg.muted">
                        Subscribe to the same topic in the ntfy app.
                      </Text>
                      {ntfyConnected ? (
                        <chakra.button
                          type="button"
                          onClick={() => void disconnectPhone()}
                          textStyle="label"
                          color="danger"
                          cursor="pointer"
                        >
                          disconnect
                        </chakra.button>
                      ) : null}
                    </Flex>
                  </Stack>
                ) : null}
              </Box>
            ))}
          </Flex>

          {/* test results */}
          {testResult ? (
            <Box layerStyle="inset" p="3" borderRadius="small">
              <Text textStyle="label" mb="1">
                test
              </Text>
              {typeof testResult === "string" ? (
                <Text fontSize="sm">{testResult}</Text>
              ) : (
                <Stack gap="0.5">
                  <Text fontSize="sm">inbox · sent</Text>
                  {testResult.map((d) => (
                    <Text
                      key={d.channel}
                      fontSize="sm"
                      color={d.status === "sent" ? "fg" : "fg.muted"}
                    >
                      {d.channel} · {d.status}
                      {d.detail ? ` — ${d.detail}` : ""}
                    </Text>
                  ))}
                </Stack>
              )}
            </Box>
          ) : null}

          {error ? (
            <Text fontSize="sm" color="danger">
              {error}
            </Text>
          ) : null}

          <Flex justify="space-between" align="center" gap="3" wrap="wrap">
            <Flex gap="2">
              <Button
                size="sm"
                layerStyle="raised"
                color="fg"
                onClick={() => void sendTest()}
              >
                Send test
              </Button>
              <Button
                size="sm"
                layerStyle="raised"
                color="fg"
                onClick={() => void sendTest(65_000)}
              >
                Test in 1 min
              </Button>
            </Flex>
            <Flex gap="2">
              <Button
                size="sm"
                variant="ghost"
                color="fg.muted"
                onClick={onClose}
              >
                Close
              </Button>
              <Button
                size="sm"
                bg="accent.solid"
                color="accent.fg"
                loading={saving}
                onClick={() => void save()}
              >
                Save
              </Button>
            </Flex>
          </Flex>
        </Stack>
      )}
    </Modal>
  );
}
