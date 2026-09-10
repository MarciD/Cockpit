import { z } from "zod";

/**
 * No flat settings: the calendar list is managed by this widget's own
 * `settings.tsx`, and the iCal URLs are credentials, never config.
 */
export const configSchema = z.object({});

export type CalendarConfig = z.infer<typeof configSchema>;

export const defaultConfig: CalendarConfig = {};
