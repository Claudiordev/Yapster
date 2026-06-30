import { CSSProperties } from "react";

export type IconName =
  | "logo"
  | "chat-bubble"
  | "settings"
  | "logout"
  | "dollar"
  | "phone"
  | "edit"
  | "send"
  | "github"
  | "discord"
  | "facebook"
  | "moon"
  | "sun"
  | "plus"
  | "check"
  | "search"
  | "game"
  | "close";

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

/**
 * Renders a monochrome SVG from /public/icons via a CSS mask, so the glyph
 * inherits the current text color (`background-color: currentColor`) and scales
 * with `size`. This keeps the per-use theming (coral, brand colors, hover
 * states, dark/light) that a plain <img> would lose.
 *
 * Multicolor brand marks (e.g. Google) are rendered with a plain <img>.
 */
export function Icon({ name, size = 24, className }: IconProps) {
  const url = `url(/icons/${name}.svg)`;
  const style: CSSProperties = {
    width: size,
    height: size,
    display: "inline-block",
    flexShrink: 0,
    backgroundColor: "currentColor",
    maskImage: url,
    WebkitMaskImage: url,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskPosition: "center",
    WebkitMaskPosition: "center",
    maskSize: "contain",
    WebkitMaskSize: "contain",
  };

  return <span aria-hidden className={className} style={style} />;
}
