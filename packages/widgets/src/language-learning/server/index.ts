import "server-only";
import type { WidgetServerFactory } from "../../server/contract";
import { setLearningDb } from "./infrastructure/learning-db";
import { setLlmCredential } from "./infrastructure/llm-credential";
import { routes } from "./routes";

/**
 * The vocabulary trainer's server half. Its domain, services and adapters are
 * the reference layering (see this folder's ARCHITECTURE.md); the app only
 * hands it a database handle and the shared Anthropic credential.
 */
export const languageLearningServer: WidgetServerFactory = (deps) => {
  setLearningDb(deps.db);
  setLlmCredential(() =>
    deps.getProviderConfig<{ apiKey: string }>("anthropic"),
  );
  return { id: "language-learning", routes };
};
