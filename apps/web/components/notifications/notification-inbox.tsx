"use client";

import { useRouter } from "next/navigation";
import { Box, Flex, Stack, Text, chakra } from "@chakra-ui/react";
import type { NotificationDto, Severity } from "@/lib/notifications/dto-client";
import { Modal } from "../modal";
import { useNotifications } from "./use-notifications";

interface NotificationInboxProps {
  open: boolean;
  onClose: () => void;
}

const DOT_COLOR: Record<Severity, string> = {
  info: "accent",
  action: "status.waiting",
  urgent: "danger",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

/** "Today", "Yesterday", then the todo widget's `Mon 14 Jul` style. */
function dayLabel(iso: string, now: Date): string {
  const date = new Date(iso);
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** What produced it: `data.source` when the producer set one, else the kind's namespace. */
function sourceLabel(n: NotificationDto): string {
  const fromData = n.data?.source;
  if (typeof fromData === "string" && fromData) return fromData;
  return n.kind.split(".")[0] ?? n.kind;
}

function groupByDay(items: NotificationDto[], now: Date) {
  const groups: { label: string; items: NotificationDto[] }[] = [];
  for (const item of items) {
    const label = dayLabel(item.createdAt, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

export function NotificationInbox({ open, onClose }: NotificationInboxProps) {
  const router = useRouter();
  const {
    items,
    unread,
    updatedAt,
    isLoading,
    setRead,
    dismiss,
    markAllRead,
    sendTest,
  } = useNotifications();
  const now = new Date();

  async function openItem(n: NotificationDto) {
    if (!n.readAt) void setRead(n.id, true);
    if (n.url) {
      onClose();
      router.push(n.url);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={unread > 0 ? `Inbox · ${unread} unread` : "Inbox"}
    >
      <Stack gap="1">
        {isLoading ? (
          <Text fontSize="sm" color="fg.muted">
            Loading…
          </Text>
        ) : items.length === 0 ? (
          <Text fontSize="sm" color="fg.muted">
            Nothing here yet. Recurring tasks, rejected credentials and failed
            jobs will show up in this list.
          </Text>
        ) : (
          groupByDay(items, now).map((group) => (
            <Box key={group.label}>
              <Text textStyle="label" mt="3" mb="1">
                {group.label}
              </Text>
              {group.items.map((n) => {
                const read = Boolean(n.readAt);
                return (
                  <Flex
                    key={n.id}
                    gap="3"
                    align="flex-start"
                    py="2.5"
                    borderBottomWidth="1px"
                    borderColor="border"
                  >
                    <Box
                      mt="6px"
                      boxSize="8px"
                      borderRadius="full"
                      flexShrink={0}
                      bg={read ? "transparent" : DOT_COLOR[n.severity]}
                      borderWidth={read ? "1px" : 0}
                      borderColor="border.strong"
                      aria-hidden
                    />
                    <chakra.button
                      type="button"
                      onClick={() => void openItem(n)}
                      flex="1"
                      minW="0"
                      textAlign="left"
                      cursor={n.url ? "pointer" : "default"}
                      color="fg"
                    >
                      <Text
                        textStyle="label"
                        fontSize="9px"
                        letterSpacing="0.12em"
                      >
                        {sourceLabel(n)}
                      </Text>
                      <Text
                        fontSize="sm"
                        fontWeight={read ? "normal" : "semibold"}
                        lineHeight="1.35"
                      >
                        {n.title}
                      </Text>
                      {n.body ? (
                        <Text fontSize="xs" color="fg.muted" lineHeight="1.4">
                          {n.body}
                        </Text>
                      ) : null}
                    </chakra.button>
                    <Stack gap="1" align="flex-end" flexShrink={0}>
                      <Text textStyle="meta">{timeLabel(n.createdAt)}</Text>
                      <chakra.button
                        type="button"
                        aria-label="Dismiss notification"
                        title="Dismiss"
                        onClick={() => void dismiss(n.id)}
                        color="fg.faint"
                        fontSize="13px"
                        lineHeight="1"
                        cursor="pointer"
                        _hover={{ color: "fg" }}
                      >
                        ×
                      </chakra.button>
                    </Stack>
                  </Flex>
                );
              })}
            </Box>
          ))
        )}

        <Flex justify="space-between" align="center" mt="4" gap="3" wrap="wrap">
          <Flex gap="4">
            {unread > 0 ? (
              <chakra.button
                type="button"
                onClick={() => void markAllRead()}
                textStyle="label"
                color="link"
                cursor="pointer"
                _hover={{ color: "link.hover" }}
              >
                mark all read
              </chakra.button>
            ) : null}
            <chakra.button
              type="button"
              onClick={() => void sendTest()}
              textStyle="label"
              color="link"
              cursor="pointer"
              _hover={{ color: "link.hover" }}
            >
              send a test
            </chakra.button>
          </Flex>
          <Text textStyle="meta">
            {updatedAt
              ? `polled ${timeLabel(new Date(updatedAt).toISOString())}`
              : ""}
          </Text>
        </Flex>
      </Stack>
    </Modal>
  );
}
