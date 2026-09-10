import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { profiles } from "@cockpit/db/schema";

const now = sql`(unixepoch())`;

/** A written recipe, stored as the whole document the page renders. */
export const kitchenRecipes = sqliteTable(
  "kitchen_recipes",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    recipeJson: text("recipe_json", { mode: "json" }).notNull(),
    tagsJson: text("tags_json", { mode: "json" }).notNull(),
    servings: integer("servings").notNull().default(2),
    favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
    timesCooked: integer("times_cooked").notNull().default(0),
    lastCookedAt: integer("last_cooked_at", { mode: "timestamp" }),
    image: text("image"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(now),
  },
  (t) => [index("kitchen_recipes_profile_idx").on(t.profileId, t.createdAt)],
);

/** What actually happened at the stove; the next suggestion reads this. */
export const kitchenCookLog = sqliteTable(
  "kitchen_cook_log",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    recipeId: text("recipe_id").references(() => kitchenRecipes.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    cookedAt: integer("cooked_at", { mode: "timestamp" })
      .notNull()
      .default(now),
    rating: integer("rating"),
    notes: text("notes"),
  },
  (t) => [index("kitchen_cook_log_profile_idx").on(t.profileId, t.cookedAt)],
);

/** Standing preferences: diet, allergies, equipment, time budgets. */
export const kitchenProfiles = sqliteTable("kitchen_profiles", {
  profileId: text("profile_id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),
  profileJson: text("profile_json", { mode: "json" }).notNull(),
  optionsJson: text("options_json", { mode: "json" }), // remembered per slot
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(now),
});

/** Technique cards, cached by normalised query so the second look is free. */
export const kitchenTechniques = sqliteTable("kitchen_techniques", {
  query: text("query").primaryKey(),
  cardJson: text("card_json", { mode: "json" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(now),
});
