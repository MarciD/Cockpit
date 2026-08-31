/**
 * Optional display name for greetings and the assistant's system prompt. Unset
 * is the shipped default — cockpit stays name-free until you set it.
 */
export function userName(): string | null {
  return process.env.COCKPIT_USER_NAME?.trim() || null;
}
