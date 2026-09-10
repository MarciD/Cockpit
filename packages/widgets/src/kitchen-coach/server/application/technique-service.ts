import type { TechniqueDto } from "../../types";
import type { Tone } from "../domain/chef";
import { techniqueKey } from "../domain/intent";
import type {
  Chef,
  ImageProvider,
  TechniqueRepository,
  VideoProvider,
} from "../domain/ports";

/**
 * "Avocado schneiden" → one card, cached by normalised query. Videos and the
 * photo are fetched alongside; neither is required for the card to be useful.
 */
export class TechniqueService {
  constructor(
    private readonly chef: Chef,
    private readonly repo: TechniqueRepository,
    private readonly videos: VideoProvider,
    private readonly images: ImageProvider,
  ) {}

  async card(
    query: string,
    tone: Tone,
    language: "de" | "en",
    force = false,
  ): Promise<TechniqueDto> {
    const key = techniqueKey(query);
    const cached = force ? undefined : this.repo.get(key);
    if (cached) return cached;

    const [card, videos, image] = await Promise.all([
      this.chef.technique({ tone, context: [], language }, query),
      this.videos.find(query).catch(() => []),
      this.images.find(query).catch(() => null),
    ]);
    const full: TechniqueDto = { ...card, query, videos, image };
    this.repo.save(key, full);
    return full;
  }
}
