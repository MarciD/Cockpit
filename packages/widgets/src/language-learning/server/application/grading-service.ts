import type { Grade } from "../domain/grade";
import type { SentenceGrader, VocabularyRepository } from "../domain/ports";

const KNOWN_VOCAB_LIMIT = 120;

export class GradingService {
  constructor(
    private readonly grader: SentenceGrader,
    private readonly vocab: VocabularyRepository,
  ) {}

  async grade(input: {
    profileId: string;
    language: string;
    native: string;
    prompt: string;
    answer: string;
  }): Promise<Grade> {
    const items = await this.vocab.all(input.profileId, input.language);
    const knownVocab = items.map((i) => i.term).slice(0, KNOWN_VOCAB_LIMIT);
    return this.grader.grade({
      language: input.language,
      native: input.native,
      prompt: input.prompt,
      answer: input.answer,
      knownVocab,
    });
  }
}
