/**
 * Shapes of a stored calendar credential. They live here rather than in the
 * calendar widget because the credential store (an app concern) reads and
 * writes them; the fetching and parsing live in the widget.
 */
export type CalendarSourceKind = "google" | "outlook" | "ical";

/** What is stored. The URL is the secret and never leaves the server. */
export interface CalendarSource {
  id: string;
  label: string;
  color: string;
  url: string;
  source: CalendarSourceKind;
}

/** What the browser may see. */
export interface CalendarMeta {
  id: string;
  label: string;
  color: string;
  source: CalendarSourceKind;
}
