import { z } from "zod";

/** No settings of its own; the connection lives in the credential store. */
export const configSchema = z.object({});

export type GitlabMrsConfig = z.infer<typeof configSchema>;

export const defaultConfig: GitlabMrsConfig = {};

export const PROVIDER = "gitlab";
