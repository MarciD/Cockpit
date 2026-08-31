// Server-only by convention: imported solely by /api/* (nodejs) route handlers.
import { getConjugation, putConjugation, type CockpitDb } from "@cockpit/db";
import type { ConjugationCache, ConjugationTable } from "../domain/ports";

export class DrizzleConjugationCache implements ConjugationCache {
  constructor(private readonly db: CockpitDb) {}

  async get(language: string, verb: string): Promise<ConjugationTable | null> {
    const row = getConjugation(this.db, language, verb);
    return row ? (row.tableJson as ConjugationTable) : null;
  }

  async put(
    language: string,
    verb: string,
    table: ConjugationTable,
  ): Promise<void> {
    putConjugation(this.db, language, verb, table);
  }
}
