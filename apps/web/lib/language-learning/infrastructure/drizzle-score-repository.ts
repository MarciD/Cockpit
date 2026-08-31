// Server-only by convention: imported solely by /api/* (nodejs) route handlers.
import {
  getLearningScore,
  upsertLearningScore,
  type CockpitDb,
} from "@cockpit/db";
import type { ScoreRepository } from "../domain/ports";
import type { ScoreState } from "../domain/scoring";

export class DrizzleScoreRepository implements ScoreRepository {
  constructor(private readonly db: CockpitDb) {}

  async get(profileId: string, language: string): Promise<ScoreState | null> {
    const row = getLearningScore(this.db, profileId, language);
    if (!row) return null;
    return {
      dailyGoalItems: row.dailyGoalItems,
      lastActiveDay: row.lastActiveDay ?? null,
      streakDays: row.streakDays,
      streakFreezes: row.streakFreezes,
    };
  }

  async save(
    profileId: string,
    language: string,
    state: ScoreState,
  ): Promise<void> {
    upsertLearningScore(this.db, {
      profileId,
      language,
      dailyGoalItems: state.dailyGoalItems,
      lastActiveDay: state.lastActiveDay,
      streakDays: state.streakDays,
      streakFreezes: state.streakFreezes,
    });
  }
}
