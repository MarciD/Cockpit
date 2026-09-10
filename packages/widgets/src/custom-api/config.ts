import { z } from "zod";

/**
 * `endpoint` is fetched from the browser, so it must be reachable from where
 * you sit and must never carry a secret — config is client-visible.
 */
export const configSchema = z.object({
  title: z.string(),
  endpoint: z.string(),
});

export type CustomApiConfig = z.infer<typeof configSchema>;

export const defaultConfig: CustomApiConfig = {
  title: "Custom API",
  endpoint: "/api/demo",
};
