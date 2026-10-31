import type { MotionProps } from "framer-motion";

/**
 * Fade-only motion for HeroUI popups (Select listbox, Dropdown menu, Popover).
 *
 * HeroUI's default is a scale-in. In this app the popup is positioned after it
 * first renders, so the scale animation visibly restarts/jumps as it opens (worst
 * on the first open) — a flicker. Reproduced in headless Chrome by logging the
 * popup rect per frame: with the default the size/position snap back to the
 * start state mid-animation; with a fade the popup opens once, in place.
 * Pass this as `motionProps` (Select: `popoverProps={{ motionProps }}`).
 */
export const POPUP_MOTION_PROPS: MotionProps = {
  variants: {
    enter: { opacity: 1, transition: { duration: 0.12 } },
    exit: { opacity: 0, transition: { duration: 0.08 } },
  },
};

/**
 * Drop-in for the reaction tooltip and the emoji picker: fades in while sliding down 8px from
 * above its final spot over 0.2s, and lifts back up the same way as it closes. Only the inner
 * box moves (a translate, not a scale), so the popup's own positioning is untouched and it does
 * not jump the way the scale-in does. `initial` is what a Popover starts from (a Tooltip starts
 * from `exit`), so the same props work for both.
 */
export const DROP_IN_MOTION_PROPS: MotionProps = {
  variants: {
    initial: { opacity: 0, y: -8 },
    enter: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.2, ease: "easeIn" } },
  },
};
