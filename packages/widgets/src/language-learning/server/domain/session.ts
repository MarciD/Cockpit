import type { SentenceSource } from "./sentence-task";
import type { NewItem } from "./vocabulary-item";

/** The phases of a guided topic session (ACCESS: present → practice → produce). */
export type SessionPhase =
  "present" | "practice" | "verbs" | "produce" | "done";

/** A planned session: new items (words + chunks, incl. verbs) + sentences. */
export interface SessionPlan {
  topic: string; // slug or custom label
  items: NewItem[];
  sentences: SentenceSource[];
}
