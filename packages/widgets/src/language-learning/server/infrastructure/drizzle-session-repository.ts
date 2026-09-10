// Server-only by convention: imported solely by /api/* (nodejs) route handlers.
import { randomUUID } from "node:crypto";
import {
  appendLearningSession,
  listLearningSessionsSince,
  type CockpitDb,
} from "@cockpit/db";
import type {
  SessionInput,
  SessionRecord,
  SessionRepository,
} from "../domain/ports";

export class DrizzleSessionRepository implements SessionRepository {
  constructor(private readonly db: CockpitDb) {}

  async append(session: SessionInput): Promise<void> {
    appendLearningSession(this.db, { id: randomUUID(), ...session });
  }

  async since(
    profileId: string,
    language: string,
    since: Date,
  ): Promise<SessionRecord[]> {
    return listLearningSessionsSince(this.db, profileId, language, since).map(
      (r) => ({
        id: r.id,
        profileId: r.profileId,
        language: r.language,
        at: r.at.getTime(),
        itemsAnswered: r.itemsAnswered,
        correct: r.correct,
        mode: r.mode,
      }),
    );
  }
}
