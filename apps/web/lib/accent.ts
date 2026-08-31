/**
 * Per-desk hues — warm, Atelier-tuned. Dark enough to double as fills, rings
 * and bars (the active desk's hue drives the cascading `--accent`). Rust is the
 * fallback / default accent.
 *
 * The keys are stable hue tokens stored on `profiles.accent`; the names are
 * historical, so trust the hex, not the word.
 */
const ACCENTS: Record<string, string> = {
  petrol: "#c65a34", // terracotta
  berry: "#b1556e", // clay rose
  iris: "#a76a35", // chestnut / ochre
  sage: "#7c8a55", // olive
};

const FALLBACK = "#d0552f"; // Atelier rust

/** Hue tokens offered when creating or editing a desk. */
export const ACCENT_TOKENS = Object.keys(ACCENTS);

export function accentHex(accent: string | null | undefined): string {
  return (accent && ACCENTS[accent]) || FALLBACK;
}

/**
 * Two-letter monogram for the rail spines. A desk can store its own, since
 * compound names rarely abbreviate to their first two letters; otherwise the
 * name's first two are used.
 */
export function monogram(name: string, stored?: string | null): string {
  const own = stored?.trim();
  if (own) return own.slice(0, 2).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
