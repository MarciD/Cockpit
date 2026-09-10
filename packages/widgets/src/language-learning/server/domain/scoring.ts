/**
 * Scoring & streak policies — pure, and deliberately minimal.
 *
 * Grounded in the motivation research (SDT / gamification meta-analyses): for a
 * single, self-motivated adult the hazard is the *overjustification effect*, so
 * the design frames everything as competence feedback + progress, never as a
 * controlling reward. Concretely:
 *   - a small, user-set daily *process* goal with a progress bar (goal-gradient)
 *   - a small endowed head-start on that bar (endowed-progress effect)
 *   - a retention-weighted "today's score" (itemsAnswered × accuracy), so
 *     cramming low-quality reps can't farm points
 *   - a forgiving streak with grace freezes (avoids the Duolingo streak-anxiety
 *     / loss-spiral failure mode)
 * No coin economy, no punishment, no leaderboard.
 */

export interface ScoreState {
  dailyGoalItems: number;
  /** 'YYYY-MM-DD' (local) of the last day the goal was met, or null. */
  lastActiveDay: string | null;
  streakDays: number;
  streakFreezes: number;
}

export interface DailyProgress {
  itemsAnswered: number;
  correct: number;
}

/** Pre-filled fraction of the daily ring — the endowed-progress head-start. */
export const ENDOWED_HEAD_START = 0.15;

/** Freezes cannot grow past this; one is regranted every REGRANT_EVERY days. */
export const MAX_FREEZES = 3;
export const REGRANT_EVERY = 7;

export function todayAccuracy(dp: DailyProgress): number {
  return dp.itemsAnswered === 0 ? 0 : dp.correct / dp.itemsAnswered;
}

/** Retention-weighted score for the day, framed as competence feedback. */
export function todayScore(dp: DailyProgress): number {
  return Math.round(dp.itemsAnswered * todayAccuracy(dp));
}

export function goalMet(dp: DailyProgress, state: ScoreState): boolean {
  return dp.itemsAnswered >= state.dailyGoalItems;
}

/** 0..1 progress toward today's goal, including the endowed head-start. */
export function goalProgress(dp: DailyProgress, state: ScoreState): number {
  if (state.dailyGoalItems <= 0) return 1;
  const earned = dp.itemsAnswered / state.dailyGoalItems;
  const withHeadStart = ENDOWED_HEAD_START + earned * (1 - ENDOWED_HEAD_START);
  return Math.min(1, withHeadStart);
}

/** Whole days between two 'YYYY-MM-DD' strings (b - a). */
export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00`) - Date.parse(`${a}T00:00:00`);
  return Math.round(ms / 86_400_000);
}

/**
 * Update the streak when today's goal is met. Forgiving: missed days are covered
 * by freezes before the streak resets, and freezes slowly replenish.
 * Returns the next state (pure — `today` is supplied by the caller).
 */
export function applyGoalMet(state: ScoreState, today: string): ScoreState {
  if (state.lastActiveDay === today) return state; // already counted today

  let streakDays: number;
  let streakFreezes = state.streakFreezes;

  if (state.lastActiveDay === null) {
    streakDays = 1;
  } else {
    const gap = daysBetween(state.lastActiveDay, today);
    const missed = Math.max(0, gap - 1);
    if (gap <= 1) {
      streakDays = state.streakDays + 1;
    } else if (missed <= streakFreezes) {
      streakFreezes -= missed; // freezes absorb the gap; streak survives
      streakDays = state.streakDays + 1;
    } else {
      streakDays = 1; // too long a gap — restart
    }
  }

  if (streakDays > 0 && streakDays % REGRANT_EVERY === 0) {
    streakFreezes = Math.min(MAX_FREEZES, streakFreezes + 1);
  }

  return { ...state, streakDays, streakFreezes, lastActiveDay: today };
}
