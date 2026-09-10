import type {
  IdeaDto,
  IdeaOptions,
  IdeasResponseDto,
  KitchenProfileDto,
} from "../../types";
import { SLOT_LABELS } from "../../types";
import type { Tone } from "../domain/chef";
import type {
  Chef,
  Clock,
  CookLogRepository,
  ImageProvider,
  KitchenProfileRepository,
} from "../domain/ports";
import { inSeason } from "../domain/season";

export interface DeskContext {
  /** "21 °C, klar" — from the weather widget's cache, when the user opted in. */
  weather?: string | null;
  /** "19:30 Abendessen mit Anna" — from the calendar, when opted in. */
  nextEvent?: { title: string; startsAt: Date } | null;
}

const MINUTE_MS = 60_000;
const RECENT_COOKS = 5;

/** Builds the volatile prompt block: everything true about today. */
export function buildContext(
  options: IdeaOptions,
  profile: KitchenProfileDto,
  desk: DeskContext,
  recent: { title: string; rating: number | null; notes: string | null }[],
  now: Date,
): string[] {
  const lines: string[] = [
    `Mahlzeit: ${SLOT_LABELS[options.slot]}, ${options.servings} Person(en).`,
  ];
  if (options.ingredients.length) {
    lines.push(
      `Da ist: ${options.ingredients.join(", ")}${options.onlyWhatIsThere ? " — und NICHTS einkaufen, nur damit arbeiten (Grundvorräte ausgenommen)." : "."}`,
    );
  }
  if (options.avoid.length)
    lines.push(`Nicht verwenden: ${options.avoid.join(", ")}.`);
  if (options.leftovers) lines.push("Reste zuerst aufbrauchen.");
  if (options.totalMinutes) {
    lines.push(
      `Zeit: höchstens ${options.totalMinutes} Minuten gesamt${options.activeMinutes ? `, davon ${options.activeMinutes} aktiv` : ""}.`,
    );
  }
  if (options.devices.length) {
    lines.push(`Geräte bevorzugt: ${options.devices.join(", ")}.`);
  }
  if (options.bannedDevices.length) {
    lines.push(`Heute NICHT benutzen: ${options.bannedDevices.join(", ")}.`);
  }
  if (options.cuisines.length)
    lines.push(`Richtung: ${options.cuisines.join(" oder ")}.`);
  if (options.mood) lines.push(`Stimmung: ${options.mood}.`);
  if (options.diets.length)
    lines.push(`Ernährung: ${options.diets.join(", ")}.`);
  if (profile.allergies.length) {
    lines.push(
      `ALLERGIEN, niemals überschreiben: ${profile.allergies.join(", ")}.`,
    );
  }
  if (profile.dislikes.length)
    lines.push(`Mag er nicht: ${profile.dislikes.join(", ")}.`);
  lines.push(`Schwierigkeit höchstens: ${options.difficulty}.`);
  if (options.mealPrepDays) {
    lines.push(
      `Meal Prep für ${options.mealPrepDays} Tage: Portionen hochrechnen, Lagerung und Aufwärmen erklären.`,
    );
  }
  if (options.seasonal) {
    lines.push(
      `Saison jetzt: ${inSeason(now).join(", ")}. Was Saison hat, bevorzugen.`,
    );
  }
  if (options.useWeather && desk.weather) {
    lines.push(
      `Wetter: ${desk.weather}. Wenn das die Wahl beeinflusst, sag warum.`,
    );
  }
  if (options.useCalendar && desk.nextEvent) {
    const minutes = Math.round(
      (desk.nextEvent.startsAt.getTime() - now.getTime()) / MINUTE_MS,
    );
    if (minutes > 0 && minutes < 6 * 60) {
      lines.push(
        `Termin "${desk.nextEvent.title}" in ${minutes} Minuten — es muss vorher fertig sein.`,
      );
    }
  }
  if (options.cookbook !== "off" && recent.length) {
    lines.push(
      `Zuletzt gekocht: ${recent
        .map(
          (r) =>
            `${r.title}${r.rating ? ` (${r.rating}/5)` : ""}${r.notes ? ` — "${r.notes}"` : ""}`,
        )
        .join("; ")}.`,
    );
    if (options.cookbook === "not-recent") {
      lines.push("Nichts davon nochmal vorschlagen.");
    }
  }
  if (options.freeText.trim())
    lines.push(`Außerdem: ${options.freeText.trim()}`);
  return lines;
}

export class SuggestionService {
  constructor(
    private readonly chef: Chef,
    private readonly profiles: KitchenProfileRepository,
    private readonly cookLog: CookLogRepository,
    private readonly images: ImageProvider,
    private readonly clock: Clock,
  ) {}

  async ideas(
    profileId: string,
    options: IdeaOptions,
    tone: Tone,
    language: "de" | "en",
    desk: DeskContext,
    withImages: boolean,
  ): Promise<IdeasResponseDto> {
    const { profile } = this.profiles.get(profileId);
    const recent = this.cookLog.recent(profileId, RECENT_COOKS);
    const context = options.surprise
      ? [
          `Mahlzeit: ${SLOT_LABELS[options.slot]}, ${options.servings} Person(en).`,
          "Überrasch ihn.",
        ]
      : buildContext(options, profile, desk, recent, this.clock.now());

    const ideas = await this.chef.ideas(
      { tone, context, language },
      options,
      profile,
    );
    // Remember what was asked, so the same slot opens the same way tomorrow.
    this.profiles.saveOptions(profileId, options.slot, options);

    if (!withImages) return { ideas, context };
    const withPictures = await Promise.all(
      ideas.map(async (idea: IdeaDto) => ({
        ...idea,
        image: await this.images.find(idea.title).catch(() => null),
      })),
    );
    return { ideas: withPictures, context };
  }
}
