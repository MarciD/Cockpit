import type {
  ConjugationTable,
  ItemGenerator,
  VocabularyRepository,
} from "../domain/ports";
import { termKey } from "../domain/vocabulary-item";

const KNOWN_VOCAB_LIMIT = 120;

export class ContentService {
  constructor(
    private readonly generator: ItemGenerator,
    private readonly vocab: VocabularyRepository,
  ) {}

  /** Generate + persist new items (deduped against what's already known). */
  async generate(input: {
    profileId: string;
    language: string;
    native: string;
    topic: string;
    mode: string;
    focusNote?: string;
    count: number;
  }): Promise<{ imported: number; generated: number }> {
    const items = await this.vocab.all(input.profileId, input.language);
    const knownVocab = items.map((i) => i.term).slice(0, KNOWN_VOCAB_LIMIT);
    const generated = await this.generator.generate({
      language: input.language,
      native: input.native,
      topic: input.topic,
      mode: input.mode,
      focusNote: input.focusNote,
      knownVocab,
      count: input.count,
    });
    const existing = new Set(items.map((i) => termKey(i.term)));
    const fresh = generated.filter((g) => {
      const key = termKey(g.term);
      if (existing.has(key)) return false;
      existing.add(key);
      return true;
    });
    const imported = await this.vocab.insertMany(
      input.profileId,
      input.language,
      fresh,
      "claude",
    );
    return { imported, generated: generated.length };
  }

  async conjugate(input: {
    language: string;
    native: string;
    verb: string;
    focusNote?: string;
  }): Promise<ConjugationTable> {
    return this.generator.conjugate(input);
  }
}
