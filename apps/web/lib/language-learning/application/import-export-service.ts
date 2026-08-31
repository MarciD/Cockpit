import type { VocabularyRepository } from "../domain/ports";
import { termKey } from "../domain/vocabulary-item";
import {
  parseVocabCsv,
  serializeVocabCsv,
} from "../infrastructure/csv-vocabulary-porter";

export class ImportExportService {
  constructor(private readonly vocab: VocabularyRepository) {}

  /** Import a CSV; skips terms already present so progress is never wiped. */
  async import(input: {
    profileId: string;
    language: string;
    native: string;
    csv: string;
  }): Promise<{ imported: number; skipped: number }> {
    const parsed = parseVocabCsv(input.csv, {
      termHeaders: [input.language, "term", "word"],
      translationHeaders: [input.native, "translation", "meaning"],
    });
    const existing = await this.vocab.all(input.profileId, input.language);
    const seen = new Set(existing.map((i) => termKey(i.term)));
    const fresh = parsed.filter((p) => {
      const key = termKey(p.term);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const imported = await this.vocab.insertMany(
      input.profileId,
      input.language,
      fresh,
      "csv",
    );
    return { imported, skipped: parsed.length - imported };
  }

  /** Export as CSV with headers named for the instance's languages (ChatGPT round-trip). */
  async export(input: {
    profileId: string;
    language: string;
    native: string;
  }): Promise<string> {
    const items = await this.vocab.all(input.profileId, input.language);
    return serializeVocabCsv(items, {
      termHeader: input.language,
      translationHeader: input.native,
    });
  }
}
