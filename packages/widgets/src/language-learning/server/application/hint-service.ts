import type { Hint } from "../domain/hint";
import type { Hinter, VocabularyRepository } from "../domain/ports";

export class ItemNotFoundError extends Error {
  constructor() {
    super("vocabulary item not found");
    this.name = "ItemNotFoundError";
  }
}

export class HintService {
  constructor(
    private readonly hinter: Hinter,
    private readonly vocab: VocabularyRepository,
  ) {}

  async hint(input: {
    profileId: string;
    language: string;
    native: string;
    itemId: string;
  }): Promise<Hint> {
    const items = await this.vocab.all(input.profileId, input.language);
    const item = items.find((i) => i.id === input.itemId);
    if (!item) throw new ItemNotFoundError();
    return this.hinter.hint({
      language: input.language,
      native: input.native,
      term: item.term,
      translation: item.translation,
      notes: item.notes,
      category: item.category,
    });
  }
}
