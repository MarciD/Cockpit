import { and, desc, eq } from "drizzle-orm";
import type { CockpitDb } from "@cockpit/db";
import type {
  CookLogEntryDto,
  IdeaOptions,
  KitchenProfileDto,
  RecipeDto,
  RecipeSummaryDto,
  TechniqueDto,
} from "../../types";
import { defaultProfile } from "../../config";
import type {
  CookLogRepository,
  KitchenProfileRepository,
  RecipeRepository,
  TechniqueRepository,
} from "../domain/ports";
import {
  kitchenCookLog,
  kitchenProfiles,
  kitchenRecipes,
  kitchenTechniques,
} from "../schema";

type RecipeRow = typeof kitchenRecipes.$inferSelect;

function toSummary(row: RecipeRow): RecipeSummaryDto {
  return {
    id: row.id,
    title: row.title,
    tags: Array.isArray(row.tagsJson) ? (row.tagsJson as string[]) : [],
    servings: row.servings,
    favorite: row.favorite,
    timesCooked: row.timesCooked,
    lastCookedAt: row.lastCookedAt?.toISOString() ?? null,
    image: row.image,
  };
}

function toRecipe(row: RecipeRow): RecipeDto {
  const stored = row.recipeJson as RecipeDto;
  return {
    ...stored,
    id: row.id,
    servings: row.servings,
    image: row.image,
    createdAt: row.createdAt.toISOString(),
    timesCooked: row.timesCooked,
    lastCookedAt: row.lastCookedAt?.toISOString() ?? null,
  };
}

export class DrizzleRecipeRepository implements RecipeRepository {
  constructor(
    private readonly db: CockpitDb,
    private readonly newId: () => string,
  ) {}

  list(profileId: string): RecipeSummaryDto[] {
    return this.db
      .select()
      .from(kitchenRecipes)
      .where(eq(kitchenRecipes.profileId, profileId))
      .orderBy(desc(kitchenRecipes.createdAt))
      .all()
      .map(toSummary);
  }

  get(id: string): RecipeDto | undefined {
    const row = this.db
      .select()
      .from(kitchenRecipes)
      .where(eq(kitchenRecipes.id, id))
      .get();
    return row ? toRecipe(row) : undefined;
  }

  save(profileId: string, recipe: RecipeDto, tags: string[]): RecipeDto {
    const id = recipe.id ?? this.newId();
    const values = {
      id,
      profileId,
      title: recipe.title,
      recipeJson: { ...recipe, id },
      tagsJson: tags,
      servings: recipe.servings,
      image: recipe.image,
    };
    const row = this.db
      .insert(kitchenRecipes)
      .values(values)
      .onConflictDoUpdate({
        target: kitchenRecipes.id,
        set: {
          title: values.title,
          recipeJson: values.recipeJson,
          tagsJson: values.tagsJson,
          servings: values.servings,
          image: values.image,
        },
      })
      .returning()
      .get();
    return toRecipe(row);
  }

  remove(id: string): void {
    this.db.delete(kitchenRecipes).where(eq(kitchenRecipes.id, id)).run();
  }

  setFavorite(id: string, favorite: boolean): void {
    this.db
      .update(kitchenRecipes)
      .set({ favorite })
      .where(eq(kitchenRecipes.id, id))
      .run();
  }

  recordCooked(id: string, at: Date): void {
    const row = this.db
      .select({ n: kitchenRecipes.timesCooked })
      .from(kitchenRecipes)
      .where(eq(kitchenRecipes.id, id))
      .get();
    this.db
      .update(kitchenRecipes)
      .set({ timesCooked: (row?.n ?? 0) + 1, lastCookedAt: at })
      .where(eq(kitchenRecipes.id, id))
      .run();
  }
}

export class DrizzleCookLogRepository implements CookLogRepository {
  constructor(private readonly db: CockpitDb) {}

  add(entry: {
    id: string;
    profileId: string;
    recipeId: string | null;
    title: string;
    cookedAt: Date;
    rating: number | null;
    notes: string | null;
  }): void {
    this.db.insert(kitchenCookLog).values(entry).run();
  }

  recent(profileId: string, limit: number): CookLogEntryDto[] {
    return this.db
      .select()
      .from(kitchenCookLog)
      .where(eq(kitchenCookLog.profileId, profileId))
      .orderBy(desc(kitchenCookLog.cookedAt))
      .limit(limit)
      .all()
      .map((row) => ({
        id: row.id,
        recipeId: row.recipeId ?? "",
        title: row.title,
        cookedAt: row.cookedAt.toISOString(),
        rating: row.rating,
        notes: row.notes,
      }));
  }
}

export class DrizzleKitchenProfileRepository implements KitchenProfileRepository {
  constructor(private readonly db: CockpitDb) {}

  get(profileId: string): {
    profile: KitchenProfileDto;
    options: Record<string, IdeaOptions>;
  } {
    const row = this.db
      .select()
      .from(kitchenProfiles)
      .where(eq(kitchenProfiles.profileId, profileId))
      .get();
    return {
      profile: {
        ...defaultProfile,
        ...((row?.profileJson as KitchenProfileDto) ?? {}),
      },
      options: (row?.optionsJson as Record<string, IdeaOptions>) ?? {},
    };
  }

  private upsert(profileId: string, patch: Record<string, unknown>): void {
    const current = this.db
      .select()
      .from(kitchenProfiles)
      .where(eq(kitchenProfiles.profileId, profileId))
      .get();
    const values = {
      profileId,
      profileJson: current?.profileJson ?? defaultProfile,
      optionsJson: current?.optionsJson ?? {},
      updatedAt: new Date(),
      ...patch,
    };
    this.db
      .insert(kitchenProfiles)
      .values(values)
      .onConflictDoUpdate({ target: kitchenProfiles.profileId, set: values })
      .run();
  }

  saveProfile(profileId: string, profile: KitchenProfileDto): void {
    this.upsert(profileId, { profileJson: profile });
  }

  saveOptions(profileId: string, slot: string, options: IdeaOptions): void {
    const { options: stored } = this.get(profileId);
    this.upsert(profileId, { optionsJson: { ...stored, [slot]: options } });
  }

  nudges(): { profileId: string; at: string; days: number[] }[] {
    return this.db
      .select()
      .from(kitchenProfiles)
      .all()
      .map((row) => {
        const profile = {
          ...defaultProfile,
          ...((row.profileJson as KitchenProfileDto) ?? {}),
        };
        return {
          profileId: row.profileId,
          at: profile.dinnerNudgeAt,
          days: profile.nudgeDays,
        };
      })
      .filter((n) => /^([01]\d|2[0-3]):[0-5]\d$/.test(n.at));
  }
}

export class DrizzleTechniqueRepository implements TechniqueRepository {
  constructor(private readonly db: CockpitDb) {}

  get(key: string): TechniqueDto | undefined {
    const row = this.db
      .select()
      .from(kitchenTechniques)
      .where(eq(kitchenTechniques.query, key))
      .get();
    return row ? (row.cardJson as TechniqueDto) : undefined;
  }

  save(key: string, card: TechniqueDto): void {
    this.db
      .insert(kitchenTechniques)
      .values({ query: key, cardJson: card })
      .onConflictDoUpdate({
        target: kitchenTechniques.query,
        set: { cardJson: card },
      })
      .run();
  }
}

/** Kept so a future "search my cookbook" can filter without a table scan. */
export const recipeByTitle = (
  db: CockpitDb,
  profileId: string,
  title: string,
) =>
  db
    .select()
    .from(kitchenRecipes)
    .where(
      and(
        eq(kitchenRecipes.profileId, profileId),
        eq(kitchenRecipes.title, title),
      ),
    )
    .get();
