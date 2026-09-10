import { generateBatch } from "../domain/exercise-generator";
import type { Exercise, PracticeMode } from "../domain/exercise";
import type { SessionRepository, VocabularyRepository } from "../domain/ports";
import type { ScoreService, ScoreSummary } from "./score-service";

const DEFAULT_BATCH = 6;

export interface SubmitAnswerInput {
  profileId: string;
  language: string;
  itemId: string;
  correct: boolean;
  mode: PracticeMode;
  /** Local 'YYYY-MM-DD' from the client (keeps the day boundary in the user's tz). */
  today: string;
  dailyGoalItems?: number;
}

export class PracticeService {
  constructor(
    private readonly vocab: VocabularyRepository,
    private readonly sessions: SessionRepository,
    private readonly scoreService: ScoreService,
  ) {}

  async nextBatch(
    profileId: string,
    language: string,
    mode: PracticeMode,
    count: number = DEFAULT_BATCH,
  ): Promise<Exercise[]> {
    const items = await this.vocab.all(profileId, language);
    return generateBatch({
      items,
      mode,
      count,
      now: Date.now(),
      rng: Math.random,
    });
  }

  /** Record one answered item + log it as a session event; return the day summary. */
  async submitAnswer(input: SubmitAnswerInput): Promise<ScoreSummary> {
    await this.vocab.recordAnswer(input.itemId, input.correct);
    await this.sessions.append({
      profileId: input.profileId,
      language: input.language,
      itemsAnswered: 1,
      correct: input.correct ? 1 : 0,
      mode: input.mode,
    });
    return this.scoreService.registerActivity(
      input.profileId,
      input.language,
      input.today,
      input.dailyGoalItems,
    );
  }
}
