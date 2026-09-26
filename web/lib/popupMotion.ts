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
