/**
 * The stored shape of each widget connection. They live here, not in the
 * widgets, because the credential store and the connection routes (app
 * concerns) read and write them.
 */
export interface GitLabConfig {
  baseUrl: string;
  token: string;
}

export interface JiraConfig {
  site: string;
  email: string;
  token: string;
}

/** The pre-multi-calendar shape, still migrated on read. */
export interface GoogleCalendarConfig {
  icalUrl: string;
}
