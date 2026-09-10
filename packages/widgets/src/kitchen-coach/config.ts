import { z } from "zod";
import type { IdeaOptions, KitchenProfileDto, MealSlot } from "./types";

/**
 * Flat for the generated settings form. Everything with a list (diets,
 * allergies, dislikes, equipment) is the Profil tab on the full page, so the
 * settings modal stays four fields and a nudge time.
 */
export const configSchema = z.object({
  tone: z.enum(["mild", "ramsay", "volle-kanne"]),
  defaultServings: z.number(),
  language: z.enum(["de", "en"]),
  tileMode: z.enum(["fragen", "heute"]),
  images: z.enum(["aus", "symbolbilder", "eigene"]),
  model: z.enum(["fast", "balanced", "deep"]),
});

export type KitchenConfig = z.infer<typeof configSchema>;

export const defaultConfig: KitchenConfig = {
  tone: "ramsay",
  defaultServings: 2,
  language: "de",
  tileMode: "fragen",
  images: "symbolbilder",
  model: "balanced",
};

/** Before 10:30 breakfast, before 14:30 lunch, otherwise dinner. */
export function slotForTime(date: Date): MealSlot {
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes < 10 * 60 + 30) return "frueh";
  if (minutes < 14 * 60 + 30) return "mittag";
  return "abend";
}

export const defaultProfile: KitchenProfileDto = {
  servings: 2,
  diets: [],
  allergies: [],
  dislikes: [],
  basics: ["Salz", "Pfeffer", "Olivenöl", "Zwiebeln", "Knoblauch"],
  spice: 1,
  devices: ["induktion", "ofen", "airfryer", "mum5"],
  extraDevices: [],
  cuisines: [],
  weekdayMinutes: 45,
  weekendMinutes: 90,
  dinnerNudgeAt: "16:30",
  nudgeDays: [0, 1, 2, 3, 4, 5, 6],
};

/** The options a fresh request starts from, before the slot's remembered ones. */
export function defaultOptions(
  slot: MealSlot,
  profile: KitchenProfileDto,
  weekend: boolean,
): IdeaOptions {
  return {
    slot,
    servings: profile.servings,
    ingredients: [],
    avoid: [],
    onlyWhatIsThere: false,
    leftovers: false,
    totalMinutes: weekend ? profile.weekendMinutes : profile.weekdayMinutes,
    activeMinutes: null,
    devices: profile.devices,
    bannedDevices: [],
    cuisines: [],
    mood: null,
    diets: profile.diets,
    difficulty: "mittel",
    mealPrepDays: null,
    seasonal: true,
    useWeather: true,
    useCalendar: true,
    cookbook: "favourites",
    count: 3,
    surprise: false,
    freeText: "",
  };
}
