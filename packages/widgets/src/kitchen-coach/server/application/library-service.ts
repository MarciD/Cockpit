import type {
  CookLogEntryDto,
  KitchenProfileDto,
  RecipeSummaryDto,
} from "../../types";
import type {
  CookLogRepository,
  KitchenProfileRepository,
  RecipeRepository,
} from "../domain/ports";

const RECENT_LIMIT = 20;

/** The Kochbuch and the Profil tab: plain reads and writes, no LLM. */
export class LibraryService {
  constructor(
    private readonly recipes: RecipeRepository,
    private readonly cookLog: CookLogRepository,
    private readonly profiles: KitchenProfileRepository,
  ) {}

  list(profileId: string): RecipeSummaryDto[] {
    return this.recipes.list(profileId);
  }

  get(id: string) {
    return this.recipes.get(id);
  }

  remove(id: string): void {
    this.recipes.remove(id);
  }

  setFavorite(id: string, favorite: boolean): void {
    this.recipes.setFavorite(id, favorite);
  }

  history(profileId: string): CookLogEntryDto[] {
    return this.cookLog.recent(profileId, RECENT_LIMIT);
  }

  profile(profileId: string): KitchenProfileDto {
    return this.profiles.get(profileId).profile;
  }

  saveProfile(profileId: string, profile: KitchenProfileDto): void {
    this.profiles.saveProfile(profileId, profile);
  }

  options(profileId: string) {
    return this.profiles.get(profileId).options;
  }

  /** Desks that asked for an evening nudge, with the time and weekdays. */
  nudges() {
    return this.profiles.nudges();
  }
}
