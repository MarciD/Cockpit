/**
 * German seasonal produce, as data rather than a model call: what is in
 * season is a fact about the month, and the Chef should not spend a token
 * guessing it.
 */
const SEASON: Record<number, string[]> = {
  1: [
    "Grünkohl",
    "Rosenkohl",
    "Lauch",
    "Pastinake",
    "Rote Bete",
    "Chicorée",
    "Feldsalat",
  ],
  2: [
    "Grünkohl",
    "Lauch",
    "Pastinake",
    "Schwarzwurzel",
    "Chicorée",
    "Feldsalat",
  ],
  3: ["Bärlauch", "Lauch", "Spinat", "Radieschen", "Rhabarber", "Feldsalat"],
  4: ["Bärlauch", "Spargel", "Rhabarber", "Radieschen", "Spinat", "Kohlrabi"],
  5: ["Spargel", "Erdbeeren", "Rhabarber", "Kohlrabi", "Mangold", "Erbsen"],
  6: [
    "Erdbeeren",
    "Kirschen",
    "Zucchini",
    "Erbsen",
    "Fenchel",
    "Johannisbeeren",
  ],
  7: ["Tomaten", "Zucchini", "Aubergine", "Bohnen", "Aprikosen", "Beeren"],
  8: ["Tomaten", "Paprika", "Mais", "Pflaumen", "Zwetschgen", "Brombeeren"],
  9: ["Kürbis", "Pflaumen", "Birnen", "Trauben", "Mais", "Fenchel"],
  10: ["Kürbis", "Äpfel", "Birnen", "Rote Bete", "Wirsing", "Pastinake"],
  11: [
    "Kürbis",
    "Grünkohl",
    "Rosenkohl",
    "Wirsing",
    "Pastinake",
    "Schwarzwurzel",
  ],
  12: [
    "Grünkohl",
    "Rosenkohl",
    "Lauch",
    "Rote Bete",
    "Chicorée",
    "Schwarzwurzel",
  ],
};

export function inSeason(date: Date): string[] {
  return SEASON[date.getMonth() + 1] ?? [];
}
