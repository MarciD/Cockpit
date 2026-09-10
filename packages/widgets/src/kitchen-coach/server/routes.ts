import {
  badRequest,
  json,
  notFound,
  readJson,
  type WidgetRoutes,
} from "../../server/contract";
import { defaultOptions, defaultProfile, slotForTime } from "../config";
import type {
  IdeaOptions,
  KitchenProfileDto,
  MealSlot,
  RecipeDto,
} from "../types";
import { MEAL_SLOTS } from "../types";
import type { Tone } from "./domain/chef";
import { classifyIntent } from "./domain/intent";
import type { ModelTier } from "./infrastructure/anthropic-chef";
import { LlmNotConfiguredError } from "./infrastructure/anthropic-chef";
import type { DeskContext } from "./application/suggestion-service";
import type { KitchenServices } from "./composition";

const TONES: readonly Tone[] = ["mild", "ramsay", "volle-kanne"];
const TIERS: readonly ModelTier[] = ["fast", "balanced", "deep"];
const MAX_IDEAS = 5;

interface RequestSettings {
  tone: Tone;
  language: "de" | "en";
  tier: ModelTier;
  images: boolean;
}

function settingsFrom(body: Record<string, unknown>): RequestSettings {
  return {
    tone: TONES.includes(body.tone as Tone) ? (body.tone as Tone) : "ramsay",
    language: body.language === "en" ? "en" : "de",
    tier: TIERS.includes(body.model as ModelTier)
      ? (body.model as ModelTier)
      : "balanced",
    images: body.images !== false,
  };
}

function optionsFrom(
  body: Record<string, unknown>,
  profile: KitchenProfileDto,
): IdeaOptions {
  const raw = (body.options ?? {}) as Partial<IdeaOptions>;
  const slot = MEAL_SLOTS.includes(raw.slot as MealSlot)
    ? (raw.slot as MealSlot)
    : slotForTime(new Date());
  const base = defaultOptions(
    slot,
    profile,
    [0, 6].includes(new Date().getDay()),
  );
  const merged = { ...base, ...raw, slot };
  return {
    ...merged,
    servings: Math.min(Math.max(1, Math.round(merged.servings || 2)), 12),
    count: Math.min(Math.max(1, Math.round(merged.count || 3)), MAX_IDEAS),
  };
}

/** An LLM route answers 400 needs-connect, never a 500, when no key is stored. */
async function guarded(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof LlmNotConfiguredError) {
      return json({ error: "needs-connect" }, { status: 400 });
    }
    return json({ error: (err as Error).message }, { status: 502 });
  }
}

export function buildRoutes(
  services: KitchenServices,
  setTier: (tier: ModelTier) => void,
  desk: (profileId: string, options: IdeaOptions) => Promise<DeskContext>,
): WidgetRoutes {
  return {
    "POST ideas": async (req) => {
      const body = (await readJson<Record<string, unknown>>(req)) ?? {};
      const profileId =
        typeof body.profileId === "string" ? body.profileId : "";
      if (!profileId) return badRequest("profileId is required");
      const settings = settingsFrom(body);
      setTier(settings.tier);
      const profile = services.library.profile(profileId);
      const options = optionsFrom(body, profile);
      return guarded(async () =>
        json(
          await services.suggestions.ideas(
            profileId,
            options,
            settings.tone,
            settings.language,
            await desk(profileId, options),
            settings.images,
          ),
        ),
      );
    },

    "POST recipes": async (req, ctx) => {
      const [action] = ctx.path;
      const body = (await readJson<Record<string, unknown>>(req)) ?? {};
      const settings = settingsFrom(body);
      setTier(settings.tier);

      if (action === "save") {
        const profileId =
          typeof body.profileId === "string" ? body.profileId : "";
        const recipe = body.recipe as RecipeDto | undefined;
        if (!profileId || !recipe)
          return badRequest("profileId and recipe are required");
        const tags = Array.isArray(body.tags) ? (body.tags as string[]) : [];
        return json(services.recipes.save(profileId, recipe, tags));
      }

      if (action === "scale") {
        const recipe = body.recipe as RecipeDto | undefined;
        const servings = Number(body.servings);
        if (!recipe || !Number.isFinite(servings)) {
          return badRequest("recipe and servings are required");
        }
        return json(
          services.recipes.scale(recipe, Math.min(Math.max(1, servings), 12)),
        );
      }

      if (action === "adapt") {
        const recipe = body.recipe as RecipeDto | undefined;
        const change = typeof body.change === "string" ? body.change : "";
        if (!recipe || !change)
          return badRequest("recipe and change are required");
        return guarded(async () =>
          json(
            await services.recipes.adapt(
              recipe,
              change,
              settings.tone,
              settings.language,
            ),
          ),
        );
      }

      if (action === "schedule") {
        const recipe = body.recipe as RecipeDto | undefined;
        const mealTime = new Date(String(body.mealTime));
        if (!recipe || Number.isNaN(mealTime.getTime())) {
          return badRequest("recipe and mealTime are required");
        }
        return json(services.recipes.schedule(recipe, mealTime));
      }

      if (action === "finish") {
        const profileId =
          typeof body.profileId === "string" ? body.profileId : "";
        const title = typeof body.title === "string" ? body.title : "";
        if (!profileId || !title)
          return badRequest("profileId and title are required");
        const rating = Number(body.rating);
        services.recipes.finish(profileId, {
          recipeId: typeof body.recipeId === "string" ? body.recipeId : null,
          title,
          rating: Number.isFinite(rating)
            ? Math.min(Math.max(1, rating), 5)
            : null,
          notes: typeof body.notes === "string" ? body.notes : null,
        });
        return json({ ok: true });
      }

      // No action: write a new recipe from an idea.
      const profileId =
        typeof body.profileId === "string" ? body.profileId : "";
      const title = typeof body.title === "string" ? body.title : "";
      if (!profileId || !title)
        return badRequest("profileId and title are required");
      const profile = services.library.profile(profileId);
      const options = optionsFrom(body, profile);
      const context = Array.isArray(body.context)
        ? (body.context as string[])
        : [];
      return guarded(async () =>
        json(
          await services.recipes.write(
            profileId,
            {
              title,
              pitch: typeof body.pitch === "string" ? body.pitch : undefined,
            },
            options,
            settings.tone,
            settings.language,
            context,
            settings.images,
          ),
        ),
      );
    },

    "GET recipes": async (_req, ctx) => {
      const [id] = ctx.path;
      if (id) {
        const recipe = services.library.get(id);
        return recipe ? json(recipe) : notFound("no such recipe");
      }
      const profileId = ctx.url.searchParams.get("profileId");
      if (!profileId) return badRequest("profileId is required");
      return json({ recipes: services.library.list(profileId) });
    },

    "PATCH recipes": async (req, ctx) => {
      const [id] = ctx.path;
      if (!id) return badRequest("recipe id is required");
      const body = (await readJson<{ favorite?: unknown }>(req)) ?? {};
      if (typeof body.favorite !== "boolean")
        return badRequest("favorite is required");
      services.library.setFavorite(id, body.favorite);
      return json({ ok: true });
    },

    "DELETE recipes": async (_req, ctx) => {
      const [id] = ctx.path;
      if (!id) return badRequest("recipe id is required");
      services.library.remove(id);
      return json({ ok: true });
    },

    /** Is this a dish to cook or a technique to learn? */
    "GET intent": async (_req, ctx) => {
      const q = ctx.url.searchParams.get("q") ?? "";
      return json(classifyIntent(q));
    },

    "POST techniques": async (req) => {
      const body = (await readJson<Record<string, unknown>>(req)) ?? {};
      const query = typeof body.query === "string" ? body.query.trim() : "";
      if (!query) return badRequest("query is required");
      const settings = settingsFrom(body);
      setTier(settings.tier);
      return guarded(async () =>
        json(
          await services.techniques.card(
            query,
            settings.tone,
            settings.language,
            body.refresh === true,
          ),
        ),
      );
    },

    "POST coach": async (req) => {
      const body = (await readJson<Record<string, unknown>>(req)) ?? {};
      const messages = Array.isArray(body.messages)
        ? (body.messages as { role: "user" | "assistant"; content: string }[])
        : [];
      if (messages.length === 0) return badRequest("messages are required");
      const settings = settingsFrom(body);
      setTier(settings.tier);
      const profileId =
        typeof body.profileId === "string" ? body.profileId : "";
      const recipe = (body.recipe as RecipeDto | undefined) ?? null;
      const profile = profileId
        ? services.library.profile(profileId)
        : defaultProfile;
      return guarded(async () => {
        const stream = await services.coach.chat(
          messages,
          recipe,
          profile,
          settings.tone,
          settings.language,
        );
        return new Response(stream, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      });
    },

    "GET profile": async (_req, ctx) => {
      const profileId = ctx.url.searchParams.get("profileId");
      if (!profileId) return badRequest("profileId is required");
      return json({
        profile: services.library.profile(profileId),
        options: services.library.options(profileId),
        history: services.library.history(profileId),
      });
    },

    "PUT profile": async (req) => {
      const body = (await readJson<Record<string, unknown>>(req)) ?? {};
      const profileId =
        typeof body.profileId === "string" ? body.profileId : "";
      const profile = body.profile as KitchenProfileDto | undefined;
      if (!profileId || !profile)
        return badRequest("profileId and profile are required");
      services.library.saveProfile(profileId, {
        ...defaultProfile,
        ...profile,
      });
      return json({ ok: true });
    },
  };
}
