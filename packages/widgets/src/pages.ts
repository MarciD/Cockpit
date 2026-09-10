import type { ComponentType } from "react";
import { KitchenCoachPage } from "./kitchen-coach/page/full-page";
import { LanguageLearningPage } from "./language-learning/page/full-page";
import { XdccWatchPage } from "./xdcc-watch/page/full-page";

/** Props the generic `/w/[widget]` route hands a widget's full page. */
export interface WidgetPageProps {
  profileId: string;
  /** Remaining query parameters, e.g. `{ watch: "<id>" }`. */
  params: Record<string, string>;
  backHref: string;
}

/**
 * One line per widget with a full page. Deliberately *not* a `"use client"`
 * module: a server component importing one gets client-reference proxies, so
 * the lookup would come back undefined. The page components carry their own
 * `"use client"`.
 */
export const pageRegistry: Record<string, ComponentType<WidgetPageProps>> = {
  "kitchen-coach": KitchenCoachPage,
  "language-learning": LanguageLearningPage,
  "xdcc-watch": XdccWatchPage,
};
