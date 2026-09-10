import "server-only";
import {
  describePayload,
  EMPTY_SCHEMA,
  type WidgetServerFactory,
} from "../../server/contract";
import { PROVIDER } from "../config";
import { checkBranchMerged, type GitLabConfig } from "./infrastructure/gitlab";
import { buildRoutes, readMergeRequests } from "./routes";

/** Keeping the cache warm is what makes the tile instant when a desk opens. */
const WARM_CRON = "*/5 * * * *";

export const gitlabOpenMrsServer: WidgetServerFactory = (deps) => ({
  id: "gitlab-open-mrs",
  routes: buildRoutes(deps.throughCache),
  jobs: [
    {
      name: "warm",
      cron: WARM_CRON,
      run: async () => {
        await readMergeRequests(deps.throughCache, true);
      },
    },
  ],
  assistantTools: [
    {
      name: "get_open_mrs",
      description:
        "Your open GitLab MRs with approval status — `mine` (authored by you) and `assigned` (review requested of you). Each assigned MR has `myReview` ('none' = not yet reviewed, 'approved', or 'commented') and `updatedAfterReview` (true = new commits/replies landed after your last approval or comment, so it needs another look). `status: 'approved'` with `myReview: 'none'` means someone else already gave it the approvals it needs (see `approvedBy`) — it can merge without you, so it is not waiting on you. Each assigned MR also carries `reviewers` (`{ name, state, commented, isMe }`). A reviewer has engaged when their `state` is approved/requested_changes/review_started/unapproved OR `commented` is true — GitLab leaves `state` at 'unreviewed' through a whole comment thread, so check both. By team convention whoever reviews first also re-reviews: if a colleague has engaged and the user has not, that MR is theirs, not the user's.",
      inputSchema: EMPTY_SCHEMA,
      run: async () =>
        describePayload("GitLab", await readMergeRequests(deps.throughCache)),
    },
    {
      name: "check_branch_merged",
      description:
        "Check whether a base branch (default 'main') is fully merged into another GitLab branch. Resolves the branch by search, so a ticket number like '1297' matches 'feature/WDAW-1297-…'. If the user doesn't name the project, first call get_open_mrs and use the matching MR's project + sourceBranch.",
      inputSchema: {
        type: "object",
        properties: {
          project: {
            type: "string",
            description:
              "GitLab project path (e.g. 'group/repo') or numeric id.",
          },
          branch: {
            type: "string",
            description:
              "Target branch, or a substring / ticket number to search for.",
          },
          base: {
            type: "string",
            description:
              "Base branch expected to be merged in. Defaults to 'main'.",
          },
        },
        required: ["project", "branch"],
        additionalProperties: false,
      },
      run: async (input) => {
        const project = typeof input.project === "string" ? input.project : "";
        const branch = typeof input.branch === "string" ? input.branch : "";
        const base = typeof input.base === "string" ? input.base : "main";
        if (!project || !branch) return "Provide both a project and a branch.";
        const config = await deps.getProviderConfig<GitLabConfig>(PROVIDER);
        if (!config) return "GitLab is not connected.";
        try {
          return JSON.stringify(
            await checkBranchMerged(config, project, branch, base),
          );
        } catch (err) {
          return `Error: ${(err as Error).message}`;
        }
      },
    },
  ],
});
