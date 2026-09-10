import { integrationError, type GitLabConfig } from "@cockpit/integrations";
export type { GitLabConfig };
import { assertFetchableUrl } from "@cockpit/integrations";

/**
 * Validated, trailing-slash-free API root. The operator typed this into the
 * widget's connection, so a private/self-hosted host is fine — but it still has
 * to be an http(s) URL with no embedded credentials.
 */
function apiRoot(config: GitLabConfig): string {
  const url = assertFetchableUrl(config.baseUrl, "The GitLab base URL");
  return `${url.origin}${url.pathname}`.replace(/\/$/, "");
}

export type MrApprovalStatus = "approved" | "waiting" | "unknown";

/** What the viewer has done on a review request. */
export type MyReviewState = "none" | "approved" | "commented";

/** GitLab's own per-reviewer state (`/merge_requests/:iid/reviewers`). */
export type ReviewerState =
  | "unreviewed"
  | "reviewed"
  | "review_started"
  | "requested_changes"
  | "approved"
  | "unapproved";

/**
 * One reviewer on an MR. `state` is GitLab's flag; `commented` comes from the
 * notes timeline — both are needed, since a reviewer deep in a comment thread
 * often never flips their state off "unreviewed".
 */
export interface MrReviewer {
  name: string;
  state: ReviewerState;
  commented: boolean;
  isMe: boolean;
}

export interface GitLabMr {
  id: number;
  iid: number;
  title: string;
  webUrl: string;
  project: string;
  status: MrApprovalStatus;
  approvalsLeft: number | null;
  /** Display names of everyone who has approved (may include the viewer). */
  approvedBy: string[];
  draft: boolean;
  comments: number;
  sourceBranch: string;
  /** For review requests: every reviewer and what they've done. Empty when the
   *  lookup failed or the MR wasn't fetched with a viewer. */
  reviewers: MrReviewer[];
  /** For review requests: what the viewer has done (none / approved / commented). */
  myReview: MyReviewState;
  /** True when there was activity (new commits or a reply) after the viewer's
   *  last approval/comment — i.e. it needs another look. */
  updatedAfterReview: boolean;
}

interface RawMr {
  id: number;
  iid: number;
  title: string;
  web_url: string;
  project_id: number;
  references?: { full?: string };
  draft?: boolean;
  work_in_progress?: boolean;
  user_notes_count?: number;
  source_branch?: string;
  author?: { id?: number };
}

/**
 * `/approvals` reports actual approvers even when a project has no approval
 * *rules* configured (unlike `/approval_state`, whose `rules` array is then
 * empty). `approved_by` entries are `{ user: { id, name } }`.
 */
interface RawApprover {
  id?: number;
  name?: string;
  username?: string;
}
interface RawApprovals {
  approved?: boolean;
  approvals_left?: number;
  approved_by?: Array<RawApprover & { user?: RawApprover }>;
}

interface RawNote {
  author?: { id?: number };
  system?: boolean;
  created_at?: string;
}

interface RawCommit {
  created_at?: string;
}

interface RawReviewer {
  user?: { id?: number; name?: string; username?: string };
  state?: string;
}

const REVIEWER_STATES: readonly ReviewerState[] = [
  "unreviewed",
  "reviewed",
  "review_started",
  "requested_changes",
  "approved",
  "unapproved",
];

const toReviewerState = (s?: string): ReviewerState =>
  REVIEWER_STATES.includes(s as ReviewerState)
    ? (s as ReviewerState)
    : "unreviewed";

const MAX_MRS = 15;

const epoch = (iso?: string): number => {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
};

/**
 * Determine who is reviewing one MR, what the viewer has done, and whether it
 * went stale. Uses the reviewer roster (GitLab's own per-person state), the
 * notes timeline (my approval system-note + my comments give my last action;
 * others' real comments are replies) and the latest commit (a push). Any change
 * after my last action ⇒ `updatedAfterReview`. Best-effort: on any failure it
 * degrades to the approval-only signal with no reviewers and no staleness.
 */
async function reviewSignals(
  base: string,
  headers: Record<string, string>,
  projectId: number,
  iid: number,
  viewerId: number,
  approvedByMe: boolean,
  signal?: AbortSignal,
): Promise<{
  reviewers: MrReviewer[];
  myReview: MyReviewState;
  updatedAfterReview: boolean;
}> {
  try {
    const mr = `${base}/api/v4/projects/${projectId}/merge_requests/${iid}`;
    const [notesRes, commitsRes, reviewersRes] = await Promise.all([
      fetch(`${mr}/notes?per_page=100&sort=desc`, { headers, signal }),
      fetch(`${mr}/commits?per_page=1`, { headers, signal }),
      fetch(`${mr}/reviewers`, { headers, signal }),
    ]);
    const notes = notesRes.ok ? ((await notesRes.json()) as RawNote[]) : [];
    const commits = commitsRes.ok
      ? ((await commitsRes.json()) as RawCommit[])
      : [];
    const rawReviewers = reviewersRes.ok
      ? ((await reviewersRes.json()) as RawReviewer[])
      : [];

    // Who has actually written something — GitLab's reviewer state stays
    // "unreviewed" through an entire comment thread, so this is the other half.
    const commenters = new Set(
      notes
        .filter((n) => !n.system && n.author?.id != null)
        .map((n) => n.author!.id!),
    );
    const reviewers: MrReviewer[] = rawReviewers.flatMap((r) => {
      const id = r.user?.id;
      const name = r.user?.name ?? r.user?.username;
      if (id == null || !name) return [];
      return [
        {
          name,
          state: toReviewerState(r.state),
          commented: commenters.has(id),
          isMe: id === viewerId,
        },
      ];
    });

    const mine = notes.filter((n) => n.author?.id === viewerId);
    const iCommented = mine.some((n) => !n.system);
    const myReview: MyReviewState = approvedByMe
      ? "approved"
      : iCommented
        ? "commented"
        : "none";

    let updatedAfterReview = false;
    const myLastActionAt = Math.max(0, ...mine.map((n) => epoch(n.created_at)));
    if (myReview !== "none" && myLastActionAt > 0) {
      const othersReplyAt = Math.max(
        0,
        ...notes
          .filter((n) => n.author?.id !== viewerId && !n.system)
          .map((n) => epoch(n.created_at)),
      );
      const latestCommitAt = epoch(commits[0]?.created_at);
      updatedAfterReview =
        Math.max(othersReplyAt, latestCommitAt) > myLastActionAt;
    }
    return { reviewers, myReview, updatedAfterReview };
  } catch {
    return {
      reviewers: [],
      myReview: approvedByMe ? "approved" : "none",
      updatedAfterReview: false,
    };
  }
}

interface RawUser {
  id: number;
  username: string;
}

/** The token's own GitLab user (needed to query review requests). */
export async function getCurrentUser(
  config: GitLabConfig,
  signal?: AbortSignal,
): Promise<{ id: number; username: string }> {
  const base = apiRoot(config);
  const res = await fetch(`${base}/api/v4/user`, {
    headers: { "PRIVATE-TOKEN": config.token },
    signal,
  });
  if (!res.ok)
    throw await integrationError("GitLab", res, "GitLab user lookup");
  const u = (await res.json()) as RawUser;
  return { id: u.id, username: u.username };
}

/**
 * Fetch MRs matching a query and enrich each with approval status. Approval
 * state is a Premium/Ultimate feature — if unavailable the MR is still listed
 * with status "unknown". `excludeAuthorId` drops MRs authored by that user;
 * `viewerId` marks each MR `reviewedByMe` when that user is among its approvers.
 */
async function fetchMrs(
  base: string,
  headers: Record<string, string>,
  query: string,
  signal?: AbortSignal,
  excludeAuthorId?: number,
  viewerId?: number,
): Promise<GitLabMr[]> {
  const res = await fetch(`${base}/api/v4/merge_requests?${query}`, {
    headers,
    signal,
  });
  if (!res.ok) throw await integrationError("GitLab", res, "GitLab request");
  let raw = (await res.json()) as RawMr[];
  if (excludeAuthorId != null) {
    raw = raw.filter((m) => m.author?.id !== excludeAuthorId);
  }

  return Promise.all(
    raw.slice(0, MAX_MRS).map(async (mr): Promise<GitLabMr> => {
      let status: MrApprovalStatus = "unknown";
      let approvalsLeft: number | null = null;
      let approvedBy: string[] = [];
      let approvedByMe = false;
      try {
        const ar = await fetch(
          `${base}/api/v4/projects/${mr.project_id}/merge_requests/${mr.iid}/approvals`,
          { headers, signal },
        );
        if (ar.ok) {
          const ap = (await ar.json()) as RawApprovals;
          const approvers = (ap.approved_by ?? []).map((a) => a.user ?? a);
          const approverIds = approvers
            .map((a) => a.id)
            .filter((id): id is number => id != null);
          // Treat as "approved" only when someone actually approved (a project
          // with 0 required approvals reports approved:true vacuously).
          status =
            ap.approved && approverIds.length > 0 ? "approved" : "waiting";
          approvalsLeft = ap.approvals_left ?? null;
          approvedBy = approvers
            .map((a) => a.name ?? a.username)
            .filter((n): n is string => Boolean(n));
          if (viewerId != null) approvedByMe = approverIds.includes(viewerId);
        }
      } catch {
        // leave status "unknown"
      }

      // Review state (need-my-attention vs. settled) only matters for the
      // review-request list, i.e. when a viewer is supplied.
      let reviewers: MrReviewer[] = [];
      let myReview: MyReviewState = "none";
      let updatedAfterReview = false;
      if (viewerId != null) {
        ({ reviewers, myReview, updatedAfterReview } = await reviewSignals(
          base,
          headers,
          mr.project_id,
          mr.iid,
          viewerId,
          approvedByMe,
          signal,
        ));
      }

      return {
        id: mr.id,
        iid: mr.iid,
        title: mr.title,
        webUrl: mr.web_url,
        project: mr.references?.full ?? `#${mr.project_id}`,
        status,
        approvalsLeft,
        approvedBy,
        draft: Boolean(mr.draft ?? mr.work_in_progress),
        comments: mr.user_notes_count ?? 0,
        sourceBranch: mr.source_branch ?? "",
        reviewers,
        myReview,
        updatedAfterReview,
      };
    }),
  );
}

/**
 * Open MRs split into `mine` (authored by me) and `assigned` (review requested
 * of me, excluding my own). If the reviewer query isn't supported, `assigned`
 * is empty and `mine` still returns.
 */
export async function listMergeRequests(
  config: GitLabConfig,
  signal?: AbortSignal,
): Promise<{ mine: GitLabMr[]; assigned: GitLabMr[] }> {
  const base = apiRoot(config);
  const headers = { "PRIVATE-TOKEN": config.token };

  const mine = await fetchMrs(
    base,
    headers,
    "scope=created_by_me&state=opened&per_page=20",
    signal,
  );

  let assigned: GitLabMr[] = [];
  try {
    const me = await getCurrentUser(config, signal);
    assigned = await fetchMrs(
      base,
      headers,
      `reviewer_id=${me.id}&state=opened&scope=all&per_page=20`,
      signal,
      me.id,
      me.id,
    );
  } catch {
    assigned = [];
  }

  return { mine, assigned };
}

export interface BranchMergeStatus {
  project: string;
  base: string;
  branch: string; // resolved branch name
  resolved: boolean; // false when the search was ambiguous
  merged: boolean;
  commitsBehind: number; // commits `base` has that `branch` lacks (-1 if ambiguous)
  candidates?: string[]; // branch names when the search matched several
}

interface RawBranch {
  name: string;
}
interface RawCompare {
  commits?: unknown[];
}

/**
 * Is `base` (default "main") fully merged into `branch`? Resolves `branch` by
 * search first, so a ticket number like "1297" matches "feature/WDAW-1297-…".
 * Then compares straight `branch..base`: any commits `base` has that the branch
 * lacks means it is NOT fully merged. Read-only (branches + compare endpoints).
 */
export async function checkBranchMerged(
  config: GitLabConfig,
  project: string,
  branch: string,
  base = "main",
  signal?: AbortSignal,
): Promise<BranchMergeStatus> {
  const root = apiRoot(config);
  const headers = { "PRIVATE-TOKEN": config.token };
  const enc = encodeURIComponent(project);

  const bres = await fetch(
    `${root}/api/v4/projects/${enc}/repository/branches?search=${encodeURIComponent(branch)}&per_page=20`,
    { headers, signal },
  );
  if (!bres.ok) {
    throw await integrationError("GitLab", bres, "GitLab branch lookup");
  }
  const branches = (await bres.json()) as RawBranch[];
  if (branches.length === 0) {
    throw new Error(`No branch matching "${branch}" in ${project}.`);
  }
  const exact = branches.find((b) => b.name === branch);
  const resolved =
    exact?.name ?? (branches.length === 1 ? branches[0]!.name : null);
  if (!resolved) {
    return {
      project,
      base,
      branch,
      resolved: false,
      merged: false,
      commitsBehind: -1,
      candidates: branches.map((b) => b.name),
    };
  }

  const cres = await fetch(
    `${root}/api/v4/projects/${enc}/repository/compare?from=${encodeURIComponent(resolved)}&to=${encodeURIComponent(base)}&straight=true`,
    { headers, signal },
  );
  if (!cres.ok) {
    throw await integrationError("GitLab", cres, "GitLab compare");
  }
  const cmp = (await cres.json()) as RawCompare;
  const behind = cmp.commits?.length ?? 0;
  return {
    project,
    base,
    branch: resolved,
    resolved: true,
    merged: behind === 0,
    commitsBehind: behind,
  };
}
