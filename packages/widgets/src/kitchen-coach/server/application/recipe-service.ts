import type { IdeaOptions, RecipeDto } from "../../types";
import type { Tone } from "../domain/chef";
import type {
  Chef,
  Clock,
  CookLogRepository,
  ImageProvider,
  KitchenProfileRepository,
  RecipeRepository,
} from "../domain/ports";
import { planBackwards, type CookSchedule } from "../domain/schedule";
import { scaleIngredients } from "../domain/scale";

export class RecipeService {
  constructor(
    private readonly chef: Chef,
    private readonly recipes: RecipeRepository,
    private readonly profiles: KitchenProfileRepository,
    private readonly cookLog: CookLogRepository,
    private readonly images: ImageProvider,
    private readonly clock: Clock,
    private readonly newId: () => string,
  ) {}

  async write(
    profileId: string,
    idea: { title: string; pitch?: string },
    options: IdeaOptions,
    tone: Tone,
    language: "de" | "en",
    context: string[],
    withImages: boolean,
  ): Promise<RecipeDto> {
    const { profile } = this.profiles.get(profileId);
    const recipe = await this.chef.writeRecipe(
      { tone, context, language },
      idea,
      options,
      profile,
    );
    if (!withImages) return recipe;
    return {
      ...recipe,
      image: await this.images.find(recipe.title).catch(() => null),
    };
  }

  /** Deterministic, instant, free — never a model call. */
  scale(recipe: RecipeDto, servings: number): RecipeDto {
    return {
      ...recipe,
      servings,
      zutaten: scaleIngredients(recipe.zutaten, recipe.servings, servings),
    };
  }

  /** A device swap or a variation: the Chef rewrites only what it touches. */
  adapt(
    recipe: RecipeDto,
    change: string,
    tone: Tone,
    language: "de" | "en",
  ): Promise<RecipeDto> {
    return this.chef.adaptRecipe(
      { tone, context: [], language },
      recipe,
      change,
    );
  }

  schedule(recipe: RecipeDto, mealTime: Date): CookSchedule {
    return planBackwards(recipe.zubereitung, mealTime);
  }

  save(profileId: string, recipe: RecipeDto, tags: string[]): RecipeDto {
    return this.recipes.save(profileId, recipe, tags);
  }

  /** "Fertig": the rating and the note the next suggestion will read. */
  finish(
    profileId: string,
    input: {
      recipeId: string | null;
      title: string;
      rating: number | null;
      notes: string | null;
    },
  ): void {
    const at = this.clock.now();
    this.cookLog.add({
      id: this.newId(),
      profileId,
      recipeId: input.recipeId,
      title: input.title,
      cookedAt: at,
      rating: input.rating,
      notes: input.notes,
    });
    if (input.recipeId) this.recipes.recordCooked(input.recipeId, at);
  }
}
