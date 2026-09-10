import type { KitchenProfileDto, RecipeDto } from "../../types";
import type { Tone } from "../domain/chef";
import type { Chef } from "../domain/ports";

/** "Frag den Chef": one chat, optionally about the recipe on screen. */
export class CoachService {
  constructor(private readonly chef: Chef) {}

  chat(
    messages: { role: "user" | "assistant"; content: string }[],
    recipe: RecipeDto | null,
    profile: KitchenProfileDto,
    tone: Tone,
    language: "de" | "en",
  ): Promise<ReadableStream<Uint8Array>> {
    const context = [
      `Isst: ${profile.diets.join(", ") || "alles"}.`,
      profile.allergies.length
        ? `Allergien: ${profile.allergies.join(", ")}.`
        : "",
      profile.dislikes.length
        ? `Mag nicht: ${profile.dislikes.join(", ")}.`
        : "",
    ].filter(Boolean);
    return this.chef.coach({ tone, language, context }, messages, recipe);
  }
}
