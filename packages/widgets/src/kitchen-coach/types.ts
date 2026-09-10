/** DTOs shared by the tile, the page and the server routes. Framework-free. */

export type MealSlot = "frueh" | "mittag" | "abend" | "snack";
export const MEAL_SLOTS: readonly MealSlot[] = [
  "frueh",
  "mittag",
  "abend",
  "snack",
];

export const SLOT_LABELS: Record<MealSlot, string> = {
  frueh: "Früh",
  mittag: "Mittag",
  abend: "Abend",
  snack: "Snack",
};

export type Difficulty = "leicht" | "mittel" | "anspruchsvoll";
export type Device = "induktion" | "ofen" | "airfryer" | "mum5";

export const DEVICE_LABELS: Record<Device, string> = {
  induktion: "Induktion",
  ofen: "Ofen (Umluft)",
  airfryer: "Airfryer",
  mum5: "MUM 5",
};

/** Everything an idea request can be told; remembered per slot. */
export interface IdeaOptions {
  slot: MealSlot;
  servings: number;
  ingredients: string[];
  avoid: string[];
  onlyWhatIsThere: boolean;
  leftovers: boolean;
  totalMinutes: number | null;
  activeMinutes: number | null;
  devices: Device[];
  bannedDevices: Device[];
  cuisines: string[];
  mood: string | null;
  diets: string[];
  difficulty: Difficulty;
  mealPrepDays: number | null;
  seasonal: boolean;
  useWeather: boolean;
  useCalendar: boolean;
  cookbook: "off" | "favourites" | "not-recent";
  count: number;
  surprise: boolean;
  freeText: string;
}

export interface IdeaDto {
  title: string;
  pitch: string;
  minutes: number;
  activeMinutes: number;
  difficulty: Difficulty;
  devices: string[];
  why: string;
  image: string | null;
}

export interface IdeasResponseDto {
  ideas: IdeaDto[];
  /** What the Chef was told about weather and calendar, so the UI can show it. */
  context: string[];
}

export interface IngredientDto {
  amount: string;
  item: string;
  alternative: string | null;
}

export interface StepDto {
  text: string;
  device: string | null;
  temperatureC: number | null;
  durationMin: number | null;
  /** Hours before eating this step must start (marinate, thaw, proof). */
  leadTimeHours: number | null;
}

export interface RecipeDto {
  id: string | null;
  title: string;
  servings: number;
  einordnung: {
    geschmack: string;
    textur: string;
    schwierigkeit: Difficulty;
    zeit: string;
  };
  zutaten: IngredientDto[];
  vorbereitung: string[];
  zubereitung: StepDto[];
  chefKommentar: { intro: string; fehler: string[]; worauf: string[] };
  variationen: { label: string; text: string }[];
  image: string | null;
  createdAt: string | null;
  timesCooked: number;
  lastCookedAt: string | null;
  rating: number | null;
}

export type TechniqueIntent = "ideas" | "technique" | "ambiguous";

export interface TechniqueVideoDto {
  title: string;
  channel: string;
  url: string;
  embedUrl: string;
  seconds: number | null;
}

export interface TechniqueDto {
  query: string;
  title: string;
  werkzeug: string[];
  sicherheit: string;
  schritte: { text: string; sensorik: string | null }[];
  fehler: string[];
  uebung: string;
  passtZu: string[];
  videos: TechniqueVideoDto[];
  image: string | null;
}

export interface IntentDto {
  intent: TechniqueIntent;
  /** The technique phrase, when one was recognised. */
  technique: string | null;
}

export interface CookLogEntryDto {
  id: string;
  recipeId: string;
  title: string;
  cookedAt: string;
  rating: number | null;
  notes: string | null;
}

export interface KitchenProfileDto {
  servings: number;
  diets: string[];
  allergies: string[];
  dislikes: string[];
  basics: string[];
  spice: number;
  devices: Device[];
  extraDevices: string[];
  cuisines: string[];
  weekdayMinutes: number;
  weekendMinutes: number;
  /** "16:30", or empty for no nudge. Server-side, because a job reads it. */
  dinnerNudgeAt: string;
  nudgeDays: number[];
}

export interface RecipeSummaryDto {
  id: string;
  title: string;
  tags: string[];
  servings: number;
  favorite: boolean;
  timesCooked: number;
  lastCookedAt: string | null;
  image: string | null;
}
