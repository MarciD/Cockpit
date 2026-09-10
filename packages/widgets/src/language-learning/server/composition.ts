// Composition root (poor-man's DI). Server-only by convention: imported solely
// by /api/learn/* (nodejs) route handlers. This is the ONLY place that wires
// concrete adapters to the application services — swap an adapter here (e.g. a
// local-model grader) without touching domain or application code.
import { learningDb } from "./infrastructure/learning-db";
import { ContentService } from "./application/content-service";
import { GradingService } from "./application/grading-service";
import { HintService } from "./application/hint-service";
import { ImportExportService } from "./application/import-export-service";
import { PracticeService } from "./application/practice-service";
import { ScoreService } from "./application/score-service";
import { SessionService } from "./application/session-service";
import { VerbLessonService } from "./application/verb-lesson-service";
import { AnthropicHinter } from "./infrastructure/anthropic-hinter";
import { AnthropicItemGenerator } from "./infrastructure/anthropic-item-generator";
import { AnthropicSentenceGrader } from "./infrastructure/anthropic-sentence-grader";
import { AnthropicTopicPlanner } from "./infrastructure/anthropic-topic-planner";
import { DrizzleConjugationCache } from "./infrastructure/drizzle-conjugation-cache";
import { DrizzleScoreRepository } from "./infrastructure/drizzle-score-repository";
import { DrizzleSessionRepository } from "./infrastructure/drizzle-session-repository";
import { DrizzleVocabularyRepository } from "./infrastructure/drizzle-vocabulary-repository";

export interface LanguageLearningServices {
  vocab: DrizzleVocabularyRepository;
  scores: ScoreService;
  practice: PracticeService;
  grading: GradingService;
  content: ContentService;
  hints: HintService;
  sessions: SessionService;
  verbLessons: VerbLessonService;
  importExport: ImportExportService;
}

export function languageLearningServices(): LanguageLearningServices {
  const db = learningDb();
  const vocab = new DrizzleVocabularyRepository(db);
  const scoreRepo = new DrizzleScoreRepository(db);
  const sessionRepo = new DrizzleSessionRepository(db);

  const scores = new ScoreService(scoreRepo, sessionRepo);
  const practice = new PracticeService(vocab, sessionRepo, scores);
  const grading = new GradingService(new AnthropicSentenceGrader(), vocab);
  const content = new ContentService(new AnthropicItemGenerator(), vocab);
  const hints = new HintService(new AnthropicHinter(), vocab);
  const sessions = new SessionService(new AnthropicTopicPlanner(), vocab);
  const verbLessons = new VerbLessonService(
    new AnthropicItemGenerator(),
    new DrizzleConjugationCache(db),
  );
  const importExport = new ImportExportService(vocab);

  return {
    vocab,
    scores,
    practice,
    grading,
    content,
    hints,
    sessions,
    verbLessons,
    importExport,
  };
}
