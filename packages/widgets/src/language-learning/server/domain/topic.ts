/** A learnable context/theme. Curated list is ordered by everyday usefulness
 *  (roughly A1 → B1) so beginners start with the most useful scenes. */
export interface Topic {
  slug: string;
  label: string;
}

export const CURATED_TOPICS: Topic[] = [
  { slug: "greetings", label: "Greetings & small talk" },
  { slug: "groceries", label: "Groceries & shopping" },
  { slug: "restaurant", label: "Restaurant & ordering" },
  { slug: "directions", label: "Directions & getting around" },
  { slug: "cooking", label: "Cooking & the kitchen" },
  { slug: "going_out", label: "Going out with friends" },
  { slug: "home", label: "Home & daily routine" },
  { slug: "travel", label: "Travel & transport" },
  { slug: "health", label: "Health & the pharmacy" },
  { slug: "money", label: "Money & paying" },
  { slug: "work", label: "Work & appointments" },
  { slug: "weather", label: "Weather & time" },
];

/** Human-friendly label for a slug or free-text topic. */
export function topicLabel(topic: string): string {
  const found = CURATED_TOPICS.find((t) => t.slug === topic);
  if (found) return found.label;
  return topic.trim();
}
