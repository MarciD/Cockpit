import type { SessionPlan } from "../domain/session";
import type { TopicPlanner, VocabularyRepository } from "../domain/ports";
import { buildSentenceTasks, type SentenceTask } from "../domain/sentence-task";
import { termKey } from "../domain/vocabulary-item";

const DEFAULT_ITEMS = 6; // working-memory-safe default (pragmatic; research didn't quantify)
const DEFAULT_SENTENCES = 4;

export interface TopicSession {
  topic: string;
  newItems: number;
  plan: SessionPlan;
  /** Recognition → production sequence built from the plan's sentences. */
  tasks: SentenceTask[];
}

export class SessionService {
  constructor(
    private readonly planner: TopicPlanner,
    private readonly vocab: VocabularyRepository,
  ) {}

  /** Plan a topic session, persist its new items (tagged with the topic). */
  async startTopic(input: {
    profileId: string;
    language: string;
    native: string;
    topic: string;
    focusNote?: string;
    itemCount?: number;
    sentenceCount?: number;
  }): Promise<TopicSession> {
    const existing = await this.vocab.all(input.profileId, input.language);
    const known = existing.map((i) => i.term).slice(0, 100);
    const plan = await this.planner.plan({
      language: input.language,
      native: input.native,
      topic: input.topic,
      focusNote: input.focusNote,
      knownVocab: known,
      itemCount: input.itemCount ?? DEFAULT_ITEMS,
      sentenceCount: input.sentenceCount ?? DEFAULT_SENTENCES,
    });

    const seen = new Set(existing.map((i) => termKey(i.term)));
    const fresh = plan.items.filter((it) => {
      const key = termKey(it.term);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const newItems = await this.vocab.insertMany(
      input.profileId,
      input.language,
      fresh,
      "claude",
      input.topic,
    );

    return {
      topic: input.topic,
      newItems,
      plan: { topic: input.topic, items: fresh, sentences: plan.sentences },
      tasks: buildSentenceTasks(plan.sentences, Math.random),
    };
  }

  /** Sentence-only session over the CURRENT deck — generates sentences that
   *  reuse known vocabulary; saves no new items. */
  async startSentences(input: {
    profileId: string;
    language: string;
    native: string;
    count?: number;
  }): Promise<{ tasks: SentenceTask[] }> {
    const existing = await this.vocab.all(input.profileId, input.language);
    const known = existing.map((i) => i.term).slice(0, 100);
    const plan = await this.planner.plan({
      language: input.language,
      native: input.native,
      topic: "everyday sentences using the learner's existing vocabulary",
      knownVocab: known,
      itemCount: 0,
      sentenceCount: input.count ?? 6,
    });
    return { tasks: buildSentenceTasks(plan.sentences, Math.random) };
  }
}
