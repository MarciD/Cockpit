# Language-learning widget — architecture

A generic, multi-language vocabulary trainer. Set a target language in the
widget's settings and that instance becomes a trainer for it; add more instances
for more languages. Data is scoped by `(profileId, language)`, so instances
coexist. This widget is also the **reference example** for a domain-rich cockpit
widget — copy its layering.

## Where things live (and why the split)

Cockpit widgets are client-only and fetch through `/api/*`; server logic lives in
`apps/web`. So the bounded context is split across two places by the HTTP boundary:

```
apps/web/lib/language-learning/     ← the bounded context (server-only by convention:
  domain/                             only /api/learn/* routes import it)
    category · language · vocabulary-item · exercise · grade
    exercise-generator · scoring · ports        PURE — no React/Next/Drizzle/Anthropic
  application/                        use cases; depend only on domain (ports)
    practice · grading · content · score · import-export services
  infrastructure/                     adapters implementing the domain ports
    drizzle-*-repository              → @cockpit/db
    anthropic-sentence-grader         → @anthropic-ai/sdk (SentenceGrader port)
    anthropic-item-generator          → @anthropic-ai/sdk (ItemGenerator port)
    csv-vocabulary-porter · anthropic-client
  composition.ts                      the ONLY place adapters are wired to services

apps/web/app/api/learn/*/route.ts     thin nodejs handlers → application services
apps/web/app/learn/[language]/page.tsx thin wrapper → the page component below

packages/widgets/src/language-learning/   PRESENTATION ONLY (client)
  index.tsx                           defineWidget(...) — the dashboard tile
  ui/exercise-view · ui/score-strip   shared components (tile + page)
  ui/use-persistent-state             localStorage-backed useState (session resume)
  ui/session-error-boundary           catches render throws → Resume / Start over
  page/full-page.tsx                  the full app (exported via a package subpath)
  types.ts                            DTOs mirroring the /api/learn JSON contract
```

## Dependency rule

`domain` → (nothing) · `application` → `domain` · `infrastructure` → `domain` +
external libs · `routes`/`ui` → everything below. The rule is enforced by
structure + TypeScript + this doc (cockpit has no ESLint; see its `CLAUDE.md`).
`domain/` must never import React, Next, Drizzle, or the Anthropic SDK.

## Ports make the LLM and DB swappable

`SentenceGrader` and `ItemGenerator` are ports. The Anthropic adapters are the
defaults; drop in a local-model (e.g. Ollama) or no-LLM adapter in
`composition.ts` without touching domain or application. A subscription-tunneling
adapter is intentionally **not** provided — Anthropic disallows programmatic use
of a Pro/Max/Team subscription, so automated calls use the shared `anthropic` API
key (read only inside `/api/*`). The offline exercise engine (flashcard/MC/cloze)
uses no LLM at all.

## Scoring (why it's deliberately minimal)

The scoring policies (`domain/scoring.ts`) are grounded in motivation research:
for a single, self-motivated adult the hazard is the _overjustification effect_,
so scoring is framed as competence feedback + progress — a small daily process
goal with an endowed head-start, a retention-weighted "today's score", and a
forgiving streak with grace freezes. No coin economy, no punishment, no
leaderboard.

## Learning modes (added on top of flat practice)

- **Topic/task-based sessions** (`Sessions` tab → `ui/session-runner.tsx`):
  `TopicPlanner` (Claude) plans a scene's words + multi-word chunks + verbs and
  example sentences; new items are saved tagged with `vocab_items.topic`. The
  runner follows the ACCESS shape: **present → practice → verbs → produce**
  (recognition `reorder`/`cloze` → production, Claude-graded). A "sentences only"
  variant drills sentences over the existing deck. Grounded in SLA research
  (thematic > semantic clustering, chunk-first, retrieval practice). The active
  session `{ session, cursor }` is persisted (localStorage) so a crash/reload
  resumes the plan and place; the runner's cursor is controlled by the parent
  (`SessionsPanel`) which owns that persisted state.
- **Guided verb lesson** (`Verbs` tab → `ui/verb-lesson.tsx`): meet → pattern
  (stem highlighted via `domain/verb-lesson.ts` `stemOf`) → per-person drills
  (`buildConjugationDrills`, receptive→productive) → use in a sentence. Tables are
  cached in the `conjugations` table (`ConjugationCache` port) — offline/free
  after first generation; verb mastery updates the verb's `vocab_items` progress.
- **Pronunciation** (`ui/use-speech.ts` + `ui/speak-button.tsx`): browser Web
  Speech API 🔊 on target-language text everywhere. Purely client, no backend;
  isolated so a cloud-TTS adapter could replace it later.

New domain: `topic`, `session`, `sentence-task`, `verb-lesson` (all pure). New
services: `SessionService`, `VerbLessonService`. New adapters:
`AnthropicTopicPlanner`, `DrizzleConjugationCache`. New routes: `/api/learn/
session/{topics,topic,sentences}`, `/api/learn/verb/lesson`.

## Data flow example (answering one item)

tile/page → `POST /api/learn/answer` → `PracticeService.submitAnswer` →
`VocabularyRepository.recordAnswer` + `SessionRepository.append` +
`ScoreService.registerActivity` (applies the streak policy) → returns the day
summary the UI renders.
