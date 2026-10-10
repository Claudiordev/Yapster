/** Production web app the shipped build loads. */
const PRODUCTION_URL = "https://guildvo.com";

/**
 * The web app the shell loads: INAROW_APP_URL when set (local testing, e.g.
 * http://localhost:3000), otherwise production.
 */
export const APP_URL = process.env.INAROW_APP_URL || PRODUCTION_URL;

export const APP_ORIGIN = APP_URL ? new URL(APP_URL).origin : "";

export function isAppUrl(url: string): boolean {
  if (!APP_ORIGIN) return false;

  try {
    return new URL(url).origin === APP_ORIGIN;
  } catch {
    return false;
  }
}
