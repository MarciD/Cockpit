import { z } from "zod";

/** No settings: each task carries its own schedule. */
export const configSchema = z.object({});

export type RecurringTasksConfig = z.infer<typeof configSchema>;

export const defaultConfig: RecurringTasksConfig = {};
