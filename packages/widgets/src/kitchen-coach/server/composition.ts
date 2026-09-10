import type { WidgetServerDeps } from "../../server/contract";
import { CoachService } from "./application/coach-service";
import { LibraryService } from "./application/library-service";
import { RecipeService } from "./application/recipe-service";
import { SuggestionService } from "./application/suggestion-service";
import { TechniqueService } from "./application/technique-service";
import { AnthropicChef, type ModelTier } from "./infrastructure/anthropic-chef";
import {
  DrizzleCookLogRepository,
  DrizzleKitchenProfileRepository,
  DrizzleRecipeRepository,
  DrizzleTechniqueRepository,
} from "./infrastructure/drizzle-repositories";
import {
  PexelsImages,
  type PexelsConfig,
} from "./infrastructure/pexels-images";
import {
  YoutubeVideos,
  type YoutubeConfig,
} from "./infrastructure/youtube-videos";

export interface KitchenServices {
  coach: CoachService;
  suggestions: SuggestionService;
  recipes: RecipeService;
  techniques: TechniqueService;
  library: LibraryService;
}

/**
 * The only place adapters are wired to services. The model tier is read per
 * call from a holder the routes set from the request's widget config, so one
 * desk can run `deep` while another stays on `balanced`.
 */
export function buildServices(deps: WidgetServerDeps): {
  services: KitchenServices;
  setTier: (tier: ModelTier) => void;
} {
  let tier: ModelTier = "balanced";
  const clock = { now: () => new Date() };
  const newId = () => crypto.randomUUID();

  const chef = new AnthropicChef(
    () => deps.getProviderConfig<{ apiKey: string }>("anthropic"),
    () => tier,
  );
  const images = new PexelsImages(deps.cachedFetch, () =>
    deps.getProviderConfig<PexelsConfig>("pexels"),
  );
  const videos = new YoutubeVideos(deps.cachedFetch, () =>
    deps.getProviderConfig<YoutubeConfig>("youtube"),
  );

  const recipeRepo = new DrizzleRecipeRepository(deps.db, newId);
  const cookLog = new DrizzleCookLogRepository(deps.db);
  const profiles = new DrizzleKitchenProfileRepository(deps.db);
  const techniques = new DrizzleTechniqueRepository(deps.db);

  return {
    setTier: (next) => {
      tier = next;
    },
    services: {
      coach: new CoachService(chef),
      suggestions: new SuggestionService(
        chef,
        profiles,
        cookLog,
        images,
        clock,
      ),
      recipes: new RecipeService(
        chef,
        recipeRepo,
        profiles,
        cookLog,
        images,
        clock,
        newId,
      ),
      techniques: new TechniqueService(chef, techniques, videos, images),
      library: new LibraryService(recipeRepo, cookLog, profiles),
    },
  };
}
