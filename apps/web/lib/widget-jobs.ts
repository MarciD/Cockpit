/**
 * The hook a widget uses to tell the scheduler its jobs changed. It lives in
 * its own module so `widget-server` and `scheduler` never import each other.
 */
const globalForReloader = globalThis as unknown as {
  cockpitJobReloader?: (widgetId: string) => void;
};

export function setWidgetJobReloader(fn: (widgetId: string) => void): void {
  globalForReloader.cockpitJobReloader = fn;
}

export function reloadWidgetJobs(widgetId: string): void {
  globalForReloader.cockpitJobReloader?.(widgetId);
}
