/**
 * emoji-picker-react keeps its "Frequently Used" section in localStorage and starts it empty.
 * It has no option for defaults, so they are written there once, before the picker first renders.
 */
const STORAGE_KEY = "epr_suggested";

/**
 * Unified keys, in the order they are shown until the user's own picks take over:
 * 👍 thumbs up, 🙌 raised hands, 👀 eyes, 👏 clap, 👋 hey (wave), 😄 smile.
 */
const DEFAULT_FREQUENT = ["1f44d", "1f64c", "1f440", "1f44f", "1f44b", "1f604"];

let attempted = false;

/** Fills "Frequently Used" with the defaults, but never overwrites emoji the user already picked. */
export function seedFrequentEmojis(): void {
  if (attempted || typeof window === "undefined") return;

  attempted = true;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (stored && (JSON.parse(stored) as unknown[]).length > 0) return;

    // count 0: anything the user picks (count 1+) is listed before the defaults.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        DEFAULT_FREQUENT.map((unified) => ({ unified, original: unified, count: 0 })),
      ),
    );
  } catch {
    // Storage blocked or holding something unreadable: the section just starts empty.
  }
}
