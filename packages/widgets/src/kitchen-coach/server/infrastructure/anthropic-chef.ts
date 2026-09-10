import Anthropic from "@anthropic-ai/sdk";
import type {
  Difficulty,
  IdeaDto,
  IdeaOptions,
  KitchenProfileDto,
  RecipeDto,
  TechniqueDto,
} from "../../types";
import { chefSystemPrompt, requestContext, type Tone } from "../domain/chef";
import type { Chef, ChefRequest } from "../domain/ports";

export const MODELS = {
  fast: "claude-haiku-4-5",
  balanced: "claude-sonnet-5",
  deep: "claude-opus-4-8",
} as const;
export type ModelTier = keyof typeof MODELS;

export class LlmNotConfiguredError extends Error {
  constructor() {
    super("Anthropic API key not connected");
    this.name = "LlmNotConfiguredError";
  }
}

const IDEAS_TOKENS = 2000;
const RECIPE_TOKENS = 4000;
const TECHNIQUE_TOKENS = 2000;
const CHAT_TOKENS = 2048;
const DIFFICULTIES: readonly Difficulty[] = [
  "leicht",
  "mittel",
  "anspruchsvoll",
];

/**
 * Structured outputs, not tool-call JSON: `output_config.format` is enforced
 * by constrained decoding, so the shape is guaranteed. Every object still
 * needs `additionalProperties: false`, and no min/max or recursion is allowed.
 * Semantics are normalised below anyway — a schema cannot promise sense.
 */
const IDEAS_SCHEMA = {
  type: "object",
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          pitch: { type: "string" },
          minutes: { type: "integer" },
          activeMinutes: { type: "integer" },
          difficulty: {
            type: "string",
            enum: ["leicht", "mittel", "anspruchsvoll"],
          },
          devices: { type: "array", items: { type: "string" } },
          why: { type: "string" },
        },
        required: [
          "title",
          "pitch",
          "minutes",
          "activeMinutes",
          "difficulty",
          "devices",
          "why",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["ideas"],
  additionalProperties: false,
} as const;

const STEP_SCHEMA = {
  type: "object",
  properties: {
    text: { type: "string" },
    device: { type: ["string", "null"] },
    temperatureC: { type: ["integer", "null"] },
    durationMin: { type: ["integer", "null"] },
    leadTimeHours: { type: ["number", "null"] },
  },
  required: ["text", "device", "temperatureC", "durationMin", "leadTimeHours"],
  additionalProperties: false,
} as const;

const RECIPE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    einordnung: {
      type: "object",
      properties: {
        geschmack: { type: "string" },
        textur: { type: "string" },
        schwierigkeit: {
          type: "string",
          enum: ["leicht", "mittel", "anspruchsvoll"],
        },
        zeit: { type: "string" },
      },
      required: ["geschmack", "textur", "schwierigkeit", "zeit"],
      additionalProperties: false,
    },
    zutaten: {
      type: "array",
      items: {
        type: "object",
        properties: {
          amount: { type: "string" },
          item: { type: "string" },
          alternative: { type: ["string", "null"] },
        },
        required: ["amount", "item", "alternative"],
        additionalProperties: false,
      },
    },
    vorbereitung: { type: "array", items: { type: "string" } },
    zubereitung: { type: "array", items: STEP_SCHEMA },
    chefKommentar: {
      type: "object",
      properties: {
        intro: { type: "string" },
        fehler: { type: "array", items: { type: "string" } },
        worauf: { type: "array", items: { type: "string" } },
      },
      required: ["intro", "fehler", "worauf"],
      additionalProperties: false,
    },
    variationen: {
      type: "array",
      items: {
        type: "object",
        properties: { label: { type: "string" }, text: { type: "string" } },
        required: ["label", "text"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "title",
    "einordnung",
    "zutaten",
    "vorbereitung",
    "zubereitung",
    "chefKommentar",
    "variationen",
  ],
  additionalProperties: false,
} as const;

const TECHNIQUE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    werkzeug: { type: "array", items: { type: "string" } },
    sicherheit: { type: "string" },
    schritte: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          sensorik: { type: ["string", "null"] },
        },
        required: ["text", "sensorik"],
        additionalProperties: false,
      },
    },
    fehler: { type: "array", items: { type: "string" } },
    uebung: { type: "string" },
    passtZu: { type: "array", items: { type: "string" } },
  },
  required: [
    "title",
    "werkzeug",
    "sicherheit",
    "schritte",
    "fehler",
    "uebung",
    "passtZu",
  ],
  additionalProperties: false,
} as const;

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" && v.trim() ? v.trim() : fallback;
const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const nullableNum = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const list = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "")
    : [];
const difficulty = (v: unknown): Difficulty =>
  DIFFICULTIES.includes(v as Difficulty) ? (v as Difficulty) : "mittel";

export class AnthropicChef implements Chef {
  constructor(
    private readonly credential: () => Promise<{ apiKey: string } | null>,
    private readonly tier: () => ModelTier,
  ) {}

  private async client(): Promise<Anthropic> {
    const cfg = await this.credential();
    if (!cfg?.apiKey) throw new LlmNotConfiguredError();
    return new Anthropic({ apiKey: cfg.apiKey });
  }

  /** The persona is the cached prefix; the request context follows it. */
  private system(req: ChefRequest): Anthropic.TextBlockParam[] {
    const blocks: Anthropic.TextBlockParam[] = [
      {
        type: "text",
        text:
          chefSystemPrompt(req.tone as Tone) +
          (req.language === "en"
            ? "\n\nAntworte auf Englisch."
            : "\n\nAntworte auf Deutsch."),
        cache_control: { type: "ephemeral", ttl: "1h" },
      },
    ];
    if (req.context.length) {
      blocks.push({ type: "text", text: requestContext(req.context) });
    }
    return blocks;
  }

  private async parse<T>(
    req: ChefRequest,
    user: string,
    schema: Record<string, unknown>,
    maxTokens: number,
  ): Promise<T> {
    const client = await this.client();
    const res = await client.messages.create({
      model: MODELS[this.tier()],
      max_tokens: maxTokens,
      system: this.system(req),
      output_config: { format: { type: "json_schema", schema } },
      messages: [{ role: "user", content: user }],
    } as Anthropic.MessageCreateParamsNonStreaming);
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return JSON.parse(text) as T;
  }

  async ideas(
    req: ChefRequest,
    options: IdeaOptions,
    _profile: KitchenProfileDto,
  ): Promise<IdeaDto[]> {
    const raw = await this.parse<{ ideas: unknown[] }>(
      req,
      `Gib mir ${options.count} Ideen. Jede mit einem Pitch in deinem Ton (ein bis zwei Sätze, gern mit Spitze, aber mit konkretem Hinweis), realistischen Zeiten und den Geräten, die du tatsächlich benutzt.`,
      IDEAS_SCHEMA,
      IDEAS_TOKENS,
    );
    return (Array.isArray(raw.ideas) ? raw.ideas : [])
      .map((entry) => {
        const i = entry as Record<string, unknown>;
        return {
          title: str(i.title),
          pitch: str(i.pitch),
          minutes: Math.max(1, num(i.minutes, 30)),
          activeMinutes: Math.max(1, num(i.activeMinutes, 15)),
          difficulty: difficulty(i.difficulty),
          devices: list(i.devices),
          why: str(i.why),
          image: null,
        };
      })
      .filter((i) => i.title !== "");
  }

  private toRecipe(raw: Record<string, unknown>, servings: number): RecipeDto {
    const e = (raw.einordnung ?? {}) as Record<string, unknown>;
    const c = (raw.chefKommentar ?? {}) as Record<string, unknown>;
    return {
      id: null,
      title: str(raw.title, "Ohne Titel"),
      servings,
      einordnung: {
        geschmack: str(e.geschmack),
        textur: str(e.textur),
        schwierigkeit: difficulty(e.schwierigkeit),
        zeit: str(e.zeit),
      },
      zutaten: (Array.isArray(raw.zutaten) ? raw.zutaten : [])
        .map((z) => {
          const i = z as Record<string, unknown>;
          return {
            amount: str(i.amount),
            item: str(i.item),
            alternative:
              typeof i.alternative === "string" ? i.alternative : null,
          };
        })
        .filter((z) => z.item !== ""),
      vorbereitung: list(raw.vorbereitung),
      zubereitung: (Array.isArray(raw.zubereitung) ? raw.zubereitung : [])
        .map((s) => {
          const i = s as Record<string, unknown>;
          return {
            text: str(i.text),
            device: typeof i.device === "string" ? i.device : null,
            temperatureC: nullableNum(i.temperatureC),
            durationMin: nullableNum(i.durationMin),
            leadTimeHours: nullableNum(i.leadTimeHours),
          };
        })
        .filter((s) => s.text !== ""),
      chefKommentar: {
        intro: str(c.intro),
        fehler: list(c.fehler),
        worauf: list(c.worauf),
      },
      variationen: (Array.isArray(raw.variationen) ? raw.variationen : [])
        .map((v) => {
          const i = v as Record<string, unknown>;
          return { label: str(i.label), text: str(i.text) };
        })
        .filter((v) => v.label !== ""),
      image: null,
      createdAt: null,
      timesCooked: 0,
      lastCookedAt: null,
      rating: null,
    };
  }

  async writeRecipe(
    req: ChefRequest,
    idea: { title: string; pitch?: string },
    options: IdeaOptions,
    _profile: KitchenProfileDto,
  ): Promise<RecipeDto> {
    const raw = await this.parse<Record<string, unknown>>(
      req,
      `Schreib das Rezept für "${idea.title}" für ${options.servings} Person(en), in deinem festen Format. Zeiten und Temperaturen gerätespezifisch. Beim Chef-Kommentar: typische Fehler und worauf es wirklich ankommt.`,
      RECIPE_SCHEMA,
      RECIPE_TOKENS,
    );
    return this.toRecipe(raw, options.servings);
  }

  async adaptRecipe(
    req: ChefRequest,
    recipe: RecipeDto,
    change: string,
  ): Promise<RecipeDto> {
    const raw = await this.parse<Record<string, unknown>>(
      {
        ...req,
        context: [
          ...req.context,
          `Bestehendes Rezept: ${JSON.stringify(recipe)}`,
        ],
      },
      `Ändere das Rezept: ${change}. Behalte alles bei, was die Änderung nicht betrifft — gleiche Formulierungen, gleiche Reihenfolge. Passe nur an, was sich wirklich ändert.`,
      RECIPE_SCHEMA,
      RECIPE_TOKENS,
    );
    return {
      ...this.toRecipe(raw, recipe.servings),
      id: recipe.id,
      image: recipe.image,
    };
  }

  async technique(req: ChefRequest, query: string): Promise<TechniqueDto> {
    const raw = await this.parse<Record<string, unknown>>(
      req,
      `Erklär mir die Technik: "${query}". Werkzeug, Sicherheit (Griff, wohin die Klinge zeigt), nummerierte Schritte mit dem sensorischen Hinweis, woran ich merke dass es stimmt, typische Fehler, und eine Übung von zwei Minuten.`,
      TECHNIQUE_SCHEMA,
      TECHNIQUE_TOKENS,
    );
    return {
      query,
      title: str(raw.title, query),
      werkzeug: list(raw.werkzeug),
      sicherheit: str(raw.sicherheit),
      schritte: (Array.isArray(raw.schritte) ? raw.schritte : [])
        .map((s) => {
          const i = s as Record<string, unknown>;
          return {
            text: str(i.text),
            sensorik: typeof i.sensorik === "string" ? i.sensorik : null,
          };
        })
        .filter((s) => s.text !== ""),
      fehler: list(raw.fehler),
      uebung: str(raw.uebung),
      passtZu: list(raw.passtZu),
      videos: [],
      image: null,
    };
  }

  async coach(
    req: ChefRequest,
    messages: { role: "user" | "assistant"; content: string }[],
    recipe: RecipeDto | null,
  ): Promise<ReadableStream<Uint8Array>> {
    const client = await this.client();
    const system = this.system({
      ...req,
      context: recipe
        ? [
            ...req.context,
            `Es geht um dieses Rezept: ${JSON.stringify(recipe)}`,
          ]
        : req.context,
    });
    const stream = client.messages.stream({
      model: MODELS[this.tier()],
      max_tokens: CHAT_TOKENS,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
        } catch (err) {
          controller.enqueue(
            encoder.encode(`\n\n[Chef-Fehler: ${(err as Error).message}]`),
          );
        } finally {
          controller.close();
        }
      },
    });
  }
}
