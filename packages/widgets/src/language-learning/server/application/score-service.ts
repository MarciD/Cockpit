import type { ScoreRepository, SessionRepository } from "../domain/ports";
import {
  applyGoalMet,
  goalMet,
  goalProgress,
  todayAccuracy,
  todayScore,
  type DailyProgress,
  type ScoreState,
} from "../domain/scoring";

const DEFAULT_GOAL = 10;
const SPARK_DAYS = 7;

/** What the tile + page render — a full day-summary + streak state. */
export interface ScoreSummary {
  itemsAnswered: number;
  correct: number;
  accuracy: number;
  score: number;
  goalItems: number;
  goalProgress: number;
  goalMet: boolean;
  streakDays: number;
  streakFreezes: number;
  /** Items answered per day for the last 7 days (oldest → today). */
  spark: number[];
}

function localDayKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayKeysEndingAt(today: string, n: number): string[] {
  const start = Date.parse(`${today}T00:00:00`);
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(localDayKey(start - i * 86_400_000));
  }
  return keys;
}

export class ScoreService {
  constructor(
    private readonly scores: ScoreRepository,
    private readonly sessions: SessionRepository,
  ) {}

  private async loadState(
    profileId: string,
    language: string,
    goalOverride?: number,
  ): Promise<ScoreState> {
    const existing = await this.scores.get(profileId, language);
    if (existing) {
      return goalOverride && goalOverride !== existing.dailyGoalItems
        ? { ...existing, dailyGoalItems: goalOverride }
        : existing;
    }
    return {
      dailyGoalItems: goalOverride ?? DEFAULT_GOAL,
      lastActiveDay: null,
      streakDays: 0,
      streakFreezes: 2,
    };
  }

  private async compute(
    profileId: string,
    language: string,
    today: string,
  ): Promise<{ dp: DailyProgress; spark: number[] }> {
    const keys = dayKeysEndingAt(today, SPARK_DAYS);
    const since = new Date(`${keys[0]}T00:00:00`);
    const rows = await this.sessions.since(profileId, language, since);

    const perDay = new Map<string, number>();
    let itemsAnswered = 0;
    let correct = 0;
    for (const r of rows) {
      const key = localDayKey(r.at);
      perDay.set(key, (perDay.get(key) ?? 0) + r.itemsAnswered);
      if (key === today) {
        itemsAnswered += r.itemsAnswered;
        correct += r.correct;
      }
    }
    return {
      dp: { itemsAnswered, correct },
      spark: keys.map((k) => perDay.get(k) ?? 0),
    };
  }

  private buildSummary(
    state: ScoreState,
    dp: DailyProgress,
    spark: number[],
  ): ScoreSummary {
    return {
      itemsAnswered: dp.itemsAnswered,
      correct: dp.correct,
      accuracy: todayAccuracy(dp),
      score: todayScore(dp),
      goalItems: state.dailyGoalItems,
      goalProgress: goalProgress(dp, state),
      goalMet: goalMet(dp, state),
      streakDays: state.streakDays,
      streakFreezes: state.streakFreezes,
      spark,
    };
  }

  /** Read-only summary for GET /score. */
  async summary(
    profileId: string,
    language: string,
    today: string,
    goalOverride?: number,
  ): Promise<ScoreSummary> {
    const state = await this.loadState(profileId, language, goalOverride);
    const { dp, spark } = await this.compute(profileId, language, today);
    return this.buildSummary(state, dp, spark);
  }

  /** Recompute after an answer; advance the streak once the goal is met; persist. */
  async registerActivity(
    profileId: string,
    language: string,
    today: string,
    goalOverride?: number,
  ): Promise<ScoreSummary> {
    let state = await this.loadState(profileId, language, goalOverride);
    const { dp, spark } = await this.compute(profileId, language, today);
    if (goalMet(dp, state)) {
      state = applyGoalMet(state, today);
    }
    await this.scores.save(profileId, language, state);
    return this.buildSummary(state, dp, spark);
  }
}
