import type { IngredientDto } from "../../types";

/**
 * Scaling by hand rather than by model: it must be exact, instant and free.
 * Salt, spices and leavening do not scale linearly — a doubled recipe needs
 * well under double the salt — so they are damped and rounded.
 */
const DAMPED =
  /\b(salz|pfeffer|chili|cayenne|muskat|zimt|kreuzkümmel|paprika|hefe|backpulver|natron|safran|vanille)\b/i;
const DAMPING = 0.75;

const UNIT =
  /^([\d.,/\s]+)\s*(g|kg|ml|l|el|tl|prise|prisen|stk|stück|zehe|zehen|bund|dose|dosen|packung|päckchen)?\b(.*)$/i;

function parseAmount(raw: string): number | null {
  const cleaned = raw.trim().replace(",", ".");
  if (/^\d+\s*\/\s*\d+$/.test(cleaned)) {
    const [a, b] = cleaned.split("/").map((n) => Number(n.trim()));
    return b ? (a as number) / b : null;
  }
  const n = Number(cleaned);
  return Number.isFinite(n) && cleaned !== "" ? n : null;
}

/** Keeps kitchen-sane numbers: 0.5, 1, 1.5, 2, 250, 375 — never 1.3333. */
function tidy(value: number): string {
  if (value >= 100) return String(Math.round(value / 5) * 5);
  if (value >= 10) return String(Math.round(value));
  const halves = Math.round(value * 2) / 2;
  return Number.isInteger(halves)
    ? String(halves)
    : halves.toFixed(1).replace(".", ",");
}

export function scaleIngredient(
  ingredient: IngredientDto,
  factor: number,
): IngredientDto {
  if (factor === 1) return ingredient;
  const match = UNIT.exec(ingredient.amount.trim());
  if (!match) return ingredient;
  const [, numeric, unit = "", rest = ""] = match;
  const parsed = parseAmount(numeric ?? "");
  if (parsed === null) return ingredient;

  const damped = DAMPED.test(ingredient.item)
    ? 1 + (factor - 1) * DAMPING
    : factor;
  const scaled = parsed * damped;
  const amount = `${tidy(scaled)}${unit ? ` ${unit}` : ""}${rest}`.trim();
  return { ...ingredient, amount };
}

export function scaleIngredients(
  ingredients: IngredientDto[],
  from: number,
  to: number,
): IngredientDto[] {
  if (from <= 0 || to <= 0 || from === to) return ingredients;
  const factor = to / from;
  return ingredients.map((i) => scaleIngredient(i, factor));
}
