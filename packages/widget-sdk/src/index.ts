import type { ComponentType } from "react";
import type { QueryKey } from "@tanstack/react-query";
import type { ZodType } from "zod";

export type WidgetCategory =
  "source-control" | "issues" | "calendar" | "tasks" | "ai" | "custom";

/** Grid sizing constraints, consumed by react-grid-layout. */
export interface WidgetLayoutSpec {
  defaultW: number;
  defaultH: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  /** Row-span on the single-column mobile layout. Falls back to `defaultH`.
   *  Set this where the desktop height reads wrong at full phone width. */
  mobileH?: number;
  /** Omit this widget from the phone (mobile) layout entirely. */
  mobileHidden?: boolean;
}

/**
 * Injected into a widget's data fetcher. Widgets never import services
 * directly — they call the app's route handlers, keeping credentials
 * server-side. `signal` wires into TanStack Query cancellation.
 */
export interface WidgetDataContext {
  profileId: string;
  signal: AbortSignal;
  /** True only when the user hit the widget's manual sync button. Widgets that
   *  hit a server-cached route append `?refresh=1` when set, to bypass SWR. */
  force?: boolean;
}

export interface WidgetDataSpec<TConfig, TData> {
  queryKey: (config: TConfig, profileId: string) => QueryKey;
  queryFn: (ctx: WidgetDataContext, config: TConfig) => Promise<TData>;
  refetchIntervalMs?: number;
  staleTimeMs?: number;
  /** Show the header sync button. Defaults to `!!definition.connection`
   *  (resolved by the host card). Set true for cached-but-connectionless
   *  sources (weather, news, calendar) and for direct-fetch widgets. */
  manualRefresh?: boolean;
}

export interface WidgetComponentProps<TConfig, TData> {
  config: TConfig;
  data: TData;
  /** Opens this widget's own settings modal (e.g. from a "Connect" prompt). */
  onOpenSettings?: () => void;
}

/**
 * A lightweight, client-side, session-scoped message a widget can broadcast to
 * the dashboard (and other widgets). Widgets are isolated by default — signals
 * are the opt-in channel. The built-in `widget:context` type is auto-published
 * by the host from a widget's `describe()` so the AI widget gets desk context.
 */
export interface Signal<T = unknown> {
  type: string;
  source: string; // emitting widget instanceId
  widgetId?: string;
  payload?: T;
  at: number; // Date.now()
}

/** Returned by a widget's `describe()` — an AI-facing summary of its data. */
export interface WidgetContextSummary {
  title?: string;
  summary: string;
}

/** Payload of the `widget:context` signal the host publishes from `describe()`. */
export interface WidgetContextPayload {
  title: string;
  summary: string;
}

/** One field of a widget's connection form (e.g. a token or a base URL). */
export interface WidgetConnectionField {
  key: string;
  label: string;
  /** Rendered as a password and never prefilled; stored but never echoed back. */
  secret?: boolean;
  placeholder?: string;
  defaultValue?: string;
}

/**
 * An integration a widget connects to. Configured in the widget's OWN settings
 * (never in `config`, which is serialized to the browser) and saved to the
 * shared server credential store under `provider` — so any widget plus the
 * assistant that use the same provider share one connection.
 */
export interface WidgetConnection {
  provider: string;
  label: string;
  fields: WidgetConnectionField[];
}

/**
 * The one contract every widget implements. Adding a widget = one folder that
 * default-exports `defineWidget({...})`; the host auto-discovers it.
 */
export interface WidgetDefinition<TConfig = unknown, TData = unknown> {
  id: string;
  title: string;
  description?: string;
  icon: ComponentType;
  category: WidgetCategory;
  /** Zod schema → auto-rendered settings form (RHF) + runtime validation. */
  configSchema: ZodType<TConfig>;
  defaultConfig: TConfig;
  layout: WidgetLayoutSpec;
  data: WidgetDataSpec<TConfig, TData>;
  /** Host wraps this in Loading / Error states. */
  Component: ComponentType<WidgetComponentProps<TConfig, TData>>;
  /** Optional header count/summary derived from data, e.g. "9 ASSIGNED". */
  count?: (data: TData) => number | string | undefined;
  /**
   * Optional AI-facing one-line summary of the widget's current data. The host
   * auto-publishes it as a `widget:context` signal so the AI assistant widget
   * gets desk context without every widget wiring emit calls.
   */
  describe?: (
    config: TConfig,
    data: TData,
  ) => WidgetContextSummary | string | null;
  /**
   * An integration this widget connects to — rendered as connection fields in
   * the widget's settings and saved to the shared credential store (never in
   * `config`).
   */
  connection?: WidgetConnection;
  /**
   * A custom settings panel rendered instead of the auto-form + connection (for
   * widgets whose settings don't fit flat fields — e.g. managing a list of
   * calendars). Shown in the widget's ⚙ modal.
   */
  SettingsComponent?: ComponentType<{ onClose: () => void }>;
}

/** Identity helper — exists purely for type inference + registry discovery. */
export function defineWidget<TConfig, TData>(
  def: WidgetDefinition<TConfig, TData>,
): WidgetDefinition<TConfig, TData> {
  return def;
}

/** A configured placement of a widget on a profile. */
export interface WidgetInstance<TConfig = unknown> {
  instanceId: string;
  profileId: string;
  widgetId: string;
  config: TConfig;
}

export type WidgetRegistry = Record<string, WidgetDefinition>;
