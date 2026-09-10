import type { WidgetRoutes } from "../../server/contract";
import { handlePost as answer } from "./routes/answer";
import { handlePost as conjugate } from "./routes/conjugate";
import { handleGet as exportCsv } from "./routes/export";
import { handlePost as generate } from "./routes/generate";
import { handlePost as grade } from "./routes/grade";
import { handlePost as hint } from "./routes/hint";
import { handlePost as importCsv } from "./routes/import";
import { handleGet as listItems, handlePost as addItem } from "./routes/items";
import {
  handleDelete as deleteItem,
  handlePatch as patchItem,
} from "./routes/items-by-id";
import { handleGet as nextExercises } from "./routes/next";
import { handleGet as score } from "./routes/score";
import { handlePost as sessionSentences } from "./routes/session-sentences";
import { handlePost as sessionTopic } from "./routes/session-topic";
import { handleGet as sessionTopics } from "./routes/session-topics";
import { handlePost as verbLesson } from "./routes/verb-lesson";
import { notFound } from "../../server/contract";

/**
 * One map instead of seventeen route files. Nested paths (`session/topic`,
 * `verb/lesson`, `items/<id>`) arrive as the remaining segments in `ctx.path`.
 */
export const routes: WidgetRoutes = {
  "POST answer": answer,
  "POST conjugate": conjugate,
  "GET export": exportCsv,
  "POST generate": generate,
  "POST grade": grade,
  "POST hint": hint,
  "POST import": importCsv,
  "GET items": listItems,
  "POST items": addItem,
  "PATCH items": patchItem,
  "DELETE items": deleteItem,
  "GET next": nextExercises,
  "GET score": score,
  "GET session": (req, ctx) =>
    ctx.path[0] === "topics" ? sessionTopics() : notFound("no such route"),
  "POST session": (req, ctx) => {
    if (ctx.path[0] === "topic") return sessionTopic(req, ctx);
    if (ctx.path[0] === "sentences") return sessionSentences(req, ctx);
    return notFound("no such route");
  },
  "POST verb": (req, ctx) =>
    ctx.path[0] === "lesson" ? verbLesson(req, ctx) : notFound("no such route"),
};
