import type {
  IdeaDto,
  IdeaOptions,
  KitchenProfileDto,
  RecipeDto,
  RecipeSummaryDto,
  TechniqueDto,
  TechniqueVideoDto,
  CookLogEntryDto,
} from "../../types";
import type { Tone } from "./chef";

export interface ChefRequest {
  tone: Tone;
  context: string[];
  language: "de" | "en";
}

/** The LLM port. Three shapes, so a different provider stays a one-file swap. */
export interface Chef {
  ideas(
    req: ChefRequest,
    options: IdeaOptions,
    profile: KitchenProfileDto,
  ): Promise<IdeaDto[]>;
  writeRecipe(
    req: ChefRequest,
    idea: { title: string; pitch?: string },
    options: IdeaOptions,
    profile: KitchenProfileDto,
  ): Promise<RecipeDto>;
  /** Regenerates only the steps a device swap touches, keeping the rest. */
  adaptRecipe(
    req: ChefRequest,
    recipe: RecipeDto,
    change: string,
  ): Promise<RecipeDto>;
  technique(req: ChefRequest, query: string): Promise<TechniqueDto>;
  /** Streams the chat; the route pipes it straight to the browser. */
  coach(
    req: ChefRequest,
    messages: { role: "user" | "assistant"; content: string }[],
    recipe: RecipeDto | null,
  ): Promise<ReadableStream<Uint8Array>>;
}

export interface ImageProvider {
  /** A photo for a dish or an ingredient, or null when none is configured. */
  find(query: string): Promise<string | null>;
}

export interface VideoProvider {
  /** Short clips for a technique; empty when no key is configured. */
  find(query: string): Promise<TechniqueVideoDto[]>;
}

export interface RecipeRepository {
  list(profileId: string): RecipeSummaryDto[];
  get(id: string): RecipeDto | undefined;
  save(profileId: string, recipe: RecipeDto, tags: string[]): RecipeDto;
  remove(id: string): void;
  setFavorite(id: string, favorite: boolean): void;
  recordCooked(id: string, at: Date): void;
}

export interface CookLogRepository {
  add(entry: {
    id: string;
    profileId: string;
    recipeId: string | null;
    title: string;
    cookedAt: Date;
    rating: number | null;
    notes: string | null;
  }): void;
  recent(profileId: string, limit: number): CookLogEntryDto[];
}

export interface KitchenProfileRepository {
  get(profileId: string): {
    profile: KitchenProfileDto;
    options: Record<string, IdeaOptions>;
  };
  saveProfile(profileId: string, profile: KitchenProfileDto): void;
  saveOptions(profileId: string, slot: string, options: IdeaOptions): void;
  /** Every desk that wants an evening nudge, for the scheduler. */
  nudges(): { profileId: string; at: string; days: number[] }[];
}

export interface TechniqueRepository {
  get(key: string): TechniqueDto | undefined;
  save(key: string, card: TechniqueDto): void;
}

export interface Clock {
  now(): Date;
}
