import { z } from "zod";

/** No settings: the list is the widget. */
export const configSchema = z.object({});

export type TodoConfig = z.infer<typeof configSchema>;

export const defaultConfig: TodoConfig = {};
