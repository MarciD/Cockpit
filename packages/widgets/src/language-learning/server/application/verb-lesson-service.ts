import type {
  ConjugationCache,
  ConjugationTable,
  ItemGenerator,
} from "../domain/ports";
import {
  buildConjugationDrills,
  stemOf,
  type VerbDrill,
} from "../domain/verb-lesson";

export interface VerbLesson {
  table: ConjugationTable;
  /** The shared stem to highlight in the UI. */
  stem: string;
  drills: VerbDrill[];
}

export class VerbLessonService {
  constructor(
    private readonly generator: ItemGenerator,
    private readonly cache: ConjugationCache,
  ) {}

  /** Build a guided lesson for a verb; the table is cached after first fetch. */
  async lesson(input: {
    language: string;
    native: string;
    verb: string;
    focusNote?: string;
  }): Promise<VerbLesson> {
    const cached = await this.cache.get(input.language, input.verb);
    const table =
      cached ??
      (await (async () => {
        const generated = await this.generator.conjugate({
          language: input.language,
          native: input.native,
          verb: input.verb,
          focusNote: input.focusNote,
        });
        await this.cache.put(input.language, input.verb, generated);
        return generated;
      })());

    return {
      table,
      stem: stemOf(table.forms.map((f) => f.form)),
      drills: buildConjugationDrills(table, Math.random),
    };
  }
}
