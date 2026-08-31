"use client";

import { useState } from "react";
import { z } from "zod";
import { Box, HStack, Link, Stack, Text, chakra } from "@chakra-ui/react";
import { defineWidget, type WidgetComponentProps } from "@cockpit/widget-sdk";
import { ConnectPrompt, ReconnectPrompt } from "../lib/connect";

const configSchema = z.object({});
type Config = z.infer<typeof configSchema>;

type MrStatus = "approved" | "waiting" | "unknown";
type MyReview = "none" | "approved" | "commented";
type ReviewerState =
  | "unreviewed"
  | "reviewed"
  | "review_started"
  | "requested_changes"
  | "approved"
  | "unapproved";
interface Reviewer {
  name: string;
  state: ReviewerState;
  commented: boolean;
  isMe: boolean;
}
interface Mr {
  id: number;
  iid: number;
  title: string;
  webUrl: string;
  project: string;
  status: MrStatus;
  approvalsLeft: number | null;
  approvedBy?: string[];
  draft: boolean;
  comments: number;
  reviewers?: Reviewer[];
  myReview: MyReview;
  updatedAfterReview: boolean;
}
interface Data {
  configured: boolean;
  items?: { mine: Mr[]; assigned: Mr[] };
  error?: string;
  authFailed?: boolean;
}

type TabKey = "assigned" | "mine";

type MarkKind =
  | "review"
  | "approved"
  | "approved-by-others"
  | "draft"
  | "unknown"
  | "commented"
  | "stale";

/** A verdict was given — nothing more to do unless the MR moves. */
const DONE_STATES: ReviewerState[] = ["approved", "requested_changes"];
/** Picked it up but hasn't landed a verdict yet. */
const IN_PROGRESS_STATES: ReviewerState[] = ["review_started", "unapproved"];

/**
 * Has this person taken the MR on? GitLab's `state` alone under-reports — a
 * reviewer can run a whole comment thread while it stays "unreviewed" — so a
 * non-system note counts too.
 */
function engaged(r: Reviewer): boolean {
  return (
    DONE_STATES.includes(r.state) ||
    IN_PROGRESS_STATES.includes(r.state) ||
    r.commented
  );
}

const me = (mr: Mr): Reviewer | undefined => mr.reviewers?.find((r) => r.isMe);

/** I gave a verdict (approved / requested changes / left review comments). */
function myReviewDone(mr: Mr): boolean {
  const mine = me(mr);
  if (!mine) return mr.myReview !== "none";
  return DONE_STATES.includes(mine.state) || mine.commented;
}

/** I opened it but never finished — still mine, still owed. */
function myReviewInProgress(mr: Mr): boolean {
  const mine = me(mr);
  if (!mine || myReviewDone(mr)) return false;
  return IN_PROGRESS_STATES.includes(mine.state);
}

/**
 * A colleague took the first review and I haven't touched it. By team
 * convention whoever reviews first does the re-review, so this one is theirs.
 */
function colleagueOwns(mr: Mr): boolean {
  const reviewers = mr.reviewers ?? [];
  // No roster (older cache entry, or the lookup failed) → fall back to the
  // approval-only signal so the row still classifies sensibly.
  if (reviewers.length === 0) {
    return mr.myReview === "none" && mr.status === "approved";
  }
  if (myReviewDone(mr) || myReviewInProgress(mr)) return false;
  return reviewers.some((r) => !r.isMe && engaged(r));
}

/** Assigned tab: is this MR still waiting on me? */
function needsAttention(mr: Mr): boolean {
  if (colleagueOwns(mr)) return false;
  if (myReviewInProgress(mr)) return true;
  if (myReviewDone(mr)) return mr.updatedAfterReview;
  return true; // nobody has picked it up
}

/** Mine tab: the MR's own approval status. */
function markOf(mr: Mr): MarkKind {
  if (mr.draft) return "draft";
  if (mr.status === "approved") return "approved";
  if (mr.status === "waiting") return "review";
  return "unknown";
}

/** Assigned tab: what the MR needs from me. */
function reviewMarkOf(mr: Mr): MarkKind {
  if (colleagueOwns(mr)) {
    return mr.status === "approved" ? "approved-by-others" : "review";
  }
  if (myReviewDone(mr) && mr.updatedAfterReview) return "stale";
  if (mr.myReview === "approved") return "approved";
  // requested_changes counts as done even with no note of its own.
  if (mr.myReview === "commented" || myReviewDone(mr)) return "commented";
  return mr.draft ? "draft" : "review";
}

const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

const STATE_VERB: Partial<Record<ReviewerState, string>> = {
  approved: "approved",
  requested_changes: "changes",
  review_started: "reviewing",
  unapproved: "reviewing",
};

/**
 * What this person did, in one word. GitLab leaves `state` at "unreviewed"
 * through an entire comment thread, so fall back to the notes signal rather
 * than calling a finished review "reviewing".
 */
const verbOf = (r: Reviewer): string =>
  STATE_VERB[r.state] ?? (r.commented ? "commented" : "reviewing");

const MAX_CHIP_REVIEWERS = 2;

/** Who has taken this MR on — the "whoever reviews first re-reviews" signal. */
function ReviewerChip({ mr }: { mr: Mr }) {
  const active = (mr.reviewers ?? []).filter(engaged);
  if (active.length === 0) return null;

  const shown = active.slice(0, MAX_CHIP_REVIEWERS);
  const text = shown
    .map((r) => `${r.isMe ? "you" : initialsOf(r.name)} ${verbOf(r)}`)
    .join(" · ");
  const overflow = active.length - shown.length;
  const label = active
    .map((r) => `${r.isMe ? "You" : r.name} — ${verbOf(r)}`)
    .join("; ");

  return (
    <Text
      role="img"
      aria-label={label}
      title={label}
      textStyle="meta"
      color="fg.muted"
      whiteSpace="nowrap"
      flexShrink={0}
      mt="0.5"
    >
      {overflow > 0 ? `${text} +${overflow}` : text}
    </Text>
  );
}

/** Status encoded in shape + colour + label (never colour alone) — WCAG. */
function Mark({
  kind,
  approvers = [],
}: {
  kind: MarkKind;
  approvers?: string[];
}) {
  if (kind === "approved-by-others") {
    const who = approvers.length > 0 ? approvers.join(", ") : "someone else";
    const label = `Approved by ${who} — not by you`;
    return (
      <Box
        as="span"
        role="img"
        aria-label={label}
        title={label}
        color="status.merged"
        mt="0.5"
        flexShrink={0}
        lineHeight="1"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle
            cx="8"
            cy="8"
            r="6.4"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <path
            d="M5.2 8.2 7.1 10.1 10.9 6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Box>
    );
  }
  if (kind === "approved") {
    return (
      <Box
        as="span"
        role="img"
        aria-label="Approved"
        title="Approved"
        color="status.merged"
        fontSize="15px"
        fontWeight="bold"
        lineHeight="1"
        mt="0.5"
        flexShrink={0}
      >
        ✓
      </Box>
    );
  }
  if (kind === "review") {
    return (
      <Box
        role="img"
        aria-label="Waiting for review"
        title="Waiting for review"
        boxSize="11px"
        borderRadius="full"
        bg="accent"
        outline="3px solid"
        outlineColor="accent.tint"
        mt="1"
        flexShrink={0}
      />
    );
  }
  if (kind === "commented") {
    return (
      <Box
        as="span"
        role="img"
        aria-label="You commented — awaiting reply"
        title="You commented — awaiting reply"
        color="warning"
        mt="0.5"
        flexShrink={0}
        lineHeight="1"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden
        >
          <path d="M3 2h10a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H6l-3 3v-3a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 3 2Z" />
        </svg>
      </Box>
    );
  }
  if (kind === "stale") {
    return (
      <Box
        as="span"
        role="img"
        aria-label="Updated since your review — needs another look"
        title="Updated since your review — needs another look"
        color="danger"
        mt="0.5"
        flexShrink={0}
        lineHeight="1"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden
        >
          <path d="M3 2h10a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H6l-3 3v-3a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 3 2Z" />
          <rect
            x="7.25"
            y="3.9"
            width="1.5"
            height="3.4"
            rx="0.75"
            fill="#fff"
          />
          <rect
            x="7.25"
            y="8.1"
            width="1.5"
            height="1.5"
            rx="0.75"
            fill="#fff"
          />
        </svg>
      </Box>
    );
  }
  if (kind === "draft") {
    return (
      <Box
        role="img"
        aria-label="Draft"
        title="Draft"
        boxSize="13px"
        borderRadius="full"
        borderWidth="1.5px"
        borderColor="border.strong"
        mt="0.5"
        flexShrink={0}
      />
    );
  }
  return (
    <Box
      role="img"
      aria-label="Approval status unavailable"
      title="Approval status unavailable"
      boxSize="8px"
      borderRadius="full"
      bg="status.closed"
      mt="1.5"
      flexShrink={0}
    />
  );
}

function MrRow({ mr, mark }: { mr: Mr; mark: MarkKind }) {
  return (
    <HStack
      gap="2.5"
      align="start"
      w="100%"
      py="2"
      borderTopWidth="1px"
      borderColor="border"
    >
      <Mark kind={mark} approvers={mr.approvedBy} />
      <Stack gap="0.5" flex="1" minW="0">
        <Link
          href={mr.webUrl}
          target="_blank"
          rel="noreferrer"
          fontSize="13px"
          color="fg"
          display="block"
          w="full"
          textAlign="left"
          whiteSpace="nowrap"
          overflow="hidden"
          textOverflow="ellipsis"
        >
          {mr.title}
        </Link>
        <Text textStyle="meta" lineClamp={1}>
          !{mr.iid} · {mr.project}
        </Text>
      </Stack>
      <ReviewerChip mr={mr} />
      {mr.comments > 0 ? (
        <Box
          as="span"
          flexShrink={0}
          mt="0.5"
          bg="accent.solid"
          color="accent.fg"
          borderRadius="9px"
          px="7px"
          py="2px"
          fontFamily="mono"
          fontSize="10px"
          fontWeight="medium"
        >
          {mr.comments}
        </Box>
      ) : null}
    </HStack>
  );
}

function Section({
  title,
  mrs,
  emptyText,
  markFn,
  opacity = 1,
}: {
  title: string;
  mrs: Mr[];
  emptyText: string;
  markFn: (mr: Mr) => MarkKind;
  /** Recede a section that isn't waiting on you (colleague-owned / settled). */
  opacity?: number;
}) {
  return (
    <Stack gap="0.5">
      <HStack justify="space-between">
        <Text textStyle="label">{title}</Text>
        {mrs.length > 0 ? (
          <Text textStyle="data" fontSize="10px" color="fg.muted">
            {mrs.length}
          </Text>
        ) : null}
      </HStack>
      {mrs.length === 0 ? (
        emptyText ? (
          <Text fontSize="sm" color="fg.muted" py="1">
            {emptyText}
          </Text>
        ) : null
      ) : (
        <Stack gap="0" opacity={opacity}>
          {mrs.map((mr) => (
            <MrRow key={mr.id} mr={mr} mark={markFn(mr)} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function Tab({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: string;
}) {
  return (
    <chakra.button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      display="flex"
      alignItems="center"
      gap="1.5"
      pb="2"
      mb="-1px"
      borderBottomWidth="2px"
      borderColor={active ? "accent" : "transparent"}
      fontFamily="mono"
      fontSize="2xs"
      letterSpacing="0.1em"
      textTransform="uppercase"
      color={active ? "fg" : "fg.faint"}
      cursor="pointer"
      _hover={{ color: active ? "fg" : "fg.muted" }}
    >
      {children}
      {count > 0 ? (
        <Box as="span" color={active ? "accent" : "fg.faint"}>
          {count}
        </Box>
      ) : null}
    </chakra.button>
  );
}

function Panel({ data, onOpenSettings }: WidgetComponentProps<Config, Data>) {
  const [tab, setTab] = useState<TabKey>("assigned");

  if (!data.configured)
    return <ConnectPrompt label="GitLab" onConnect={onOpenSettings} />;
  if (data.authFailed) {
    return (
      <ReconnectPrompt
        label="GitLab"
        detail={data.error}
        onReconnect={onOpenSettings}
      />
    );
  }

  const mine = data.items?.mine ?? [];
  const assigned = data.items?.assigned ?? [];
  // A failed refresh still serves the last good cache — only fall back to the
  // bare error when there is nothing left to show.
  if (mine.length === 0 && assigned.length === 0) {
    return data.error ? (
      <Text fontSize="sm" color="danger">
        {data.error}
      </Text>
    ) : (
      <Text fontSize="sm" color="fg.muted">
        No open merge requests. You’re clear.
      </Text>
    );
  }

  // Three buckets. Mine first — stale (moved since my review) ahead of the
  // ones I started or nobody has picked up. Then the ones a colleague claimed,
  // which by team convention they'll re-review. Settled sinks to the bottom.
  const attentionMrs = assigned.filter(needsAttention);
  const stale = attentionMrs.filter((m) => myReviewDone(m));
  const attention = [
    ...stale,
    ...attentionMrs.filter((m) => !stale.includes(m)),
  ];
  const theirs = assigned.filter(colleagueOwns);
  const done = assigned.filter((m) => !needsAttention(m) && !colleagueOwns(m));

  return (
    <Stack gap="3" h="100%" w="100%" minH="0">
      {data.error ? (
        <Text fontSize="xs" color="warning" flexShrink={0} lineClamp={2}>
          Showing cached data — {data.error}
        </Text>
      ) : null}
      <HStack
        gap="4"
        flexShrink={0}
        borderBottomWidth="1px"
        borderColor="border"
      >
        <Tab
          active={tab === "assigned"}
          count={attention.length}
          onClick={() => setTab("assigned")}
        >
          Assigned to me
        </Tab>
        <Tab
          active={tab === "mine"}
          count={mine.length}
          onClick={() => setTab("mine")}
        >
          Mine
        </Tab>
      </HStack>

      <Stack gap="4" flex="1" overflowY="auto" minH="0">
        {tab === "assigned" ? (
          assigned.length === 0 ? (
            <Text fontSize="sm" color="fg.muted">
              Nothing to review. You’re clear.
            </Text>
          ) : (
            <>
              <Section
                title="Needs your attention"
                mrs={attention}
                emptyText="All caught up — nothing waiting on you."
                markFn={reviewMarkOf}
              />
              {theirs.length > 0 ? (
                <Section
                  title="A colleague has it"
                  mrs={theirs}
                  emptyText=""
                  markFn={reviewMarkOf}
                  opacity={0.75}
                />
              ) : null}
              {done.length > 0 ? (
                <Section
                  title="Settled"
                  mrs={done}
                  emptyText=""
                  markFn={reviewMarkOf}
                  opacity={0.55}
                />
              ) : null}
            </>
          )
        ) : mine.length === 0 ? (
          <Text fontSize="sm" color="fg.muted">
            None open.
          </Text>
        ) : (
          <Stack gap="0">
            {mine.map((mr) => (
              <MrRow key={mr.id} mr={mr} mark={markOf(mr)} />
            ))}
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}

const gitlabOpenMrsWidget = defineWidget<Config, Data>({
  id: "gitlab-open-mrs",
  title: "Merge Requests",
  description: "Your open GitLab MRs + review requests, with approval status.",
  icon: () => <span aria-hidden>◆</span>,
  category: "source-control",
  configSchema,
  defaultConfig: {},
  connection: {
    provider: "gitlab",
    label: "GitLab",
    fields: [
      {
        key: "baseUrl",
        label: "Base URL",
        placeholder: "https://gitlab.com",
        defaultValue: "https://gitlab.com",
      },
      {
        key: "token",
        label: "Access token (read_api)",
        secret: true,
        placeholder: "glpat-…",
      },
    ],
  },
  layout: { defaultW: 6, defaultH: 8, minW: 4, minH: 5, mobileH: 11 },
  data: {
    queryKey: (_config, profileId) => ["gitlab-open-mrs", profileId],
    queryFn: async (ctx) => {
      const res = await fetch(
        `/api/gitlab/merge-requests${ctx.force ? "?refresh=1" : ""}`,
        { signal: ctx.signal },
      );
      if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})`);
      return (await res.json()) as Data;
    },
    refetchIntervalMs: 5 * 60_000,
    staleTimeMs: 60_000,
  },
  count: (data) => {
    const mine = data.items?.mine ?? [];
    const assigned = data.items?.assigned ?? [];
    const attention = assigned.filter(needsAttention).length;
    const parts: string[] = [];
    if (attention) parts.push(`${attention} TO REVIEW`);
    if (mine.length) parts.push(`${mine.length} MINE`);
    return parts.join(" · ") || undefined;
  },
  describe: (_config, data) => {
    if (!data.configured) return null;
    if (data.authFailed) {
      return "GitLab rejected the saved token — the widget needs reconnecting.";
    }
    const mine = data.items?.mine ?? [];
    const assigned = data.items?.assigned ?? [];
    if (mine.length === 0 && assigned.length === 0) {
      return "No open merge requests.";
    }
    const attention = assigned.filter(needsAttention);
    const stale = attention.filter(
      (m) => myReviewDone(m) && m.updatedAfterReview,
    ).length;
    const started = attention.filter(myReviewInProgress).length;
    const fresh = attention.length - stale - started;
    const theirs = assigned.filter(colleagueOwns).length;
    const settled = assigned.length - attention.length - theirs;
    const parts: string[] = [];
    if (assigned.length) {
      const bits: string[] = [];
      if (fresh) bits.push(`${fresh} awaiting first review`);
      if (started) bits.push(`${started} you started but didn't finish`);
      if (stale) bits.push(`${stale} updated since you reviewed`);
      if (theirs) {
        bits.push(`${theirs} a colleague picked up (theirs to re-review)`);
      }
      if (settled) bits.push(`${settled} settled`);
      parts.push(`review requests: ${bits.join(", ")}`);
    }
    const awaiting = mine.filter(
      (m) => !m.draft && m.status === "waiting",
    ).length;
    parts.push(
      `${mine.length} authored${awaiting ? ` (${awaiting} awaiting review)` : ""}`,
    );
    return `${parts.join("; ")}.`;
  },
  Component: Panel,
});

export default gitlabOpenMrsWidget;
