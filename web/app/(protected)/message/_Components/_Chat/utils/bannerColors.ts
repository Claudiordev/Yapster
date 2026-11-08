import type { BannerColorId } from "@/types/user";

export interface BannerColor {
  id: BannerColorId;
  label: string;
  /** Tailwind gradient classes for the banner and the swatch (static strings so Tailwind keeps them). */
  className: string;
}

/** The preset banner colors; the first is the app default (same wash as the profile popup). */
export const BANNER_COLORS: readonly BannerColor[] = [
  { id: "brand", label: "Brand red", className: "bg-gradient-to-br from-brand to-brand-deep" },
  { id: "plum", label: "Plum", className: "bg-gradient-to-br from-[#8b4a6b] to-[#4a2438]" },
  { id: "slate", label: "Slate", className: "bg-gradient-to-br from-[#5b6b85] to-[#2f3a4d]" },
  { id: "graphite", label: "Graphite", className: "bg-gradient-to-br from-[#5d5f69] to-[#2f303a]" },
];

export const DEFAULT_BANNER_COLOR: BannerColorId = "brand";

export function bannerColorById(id: BannerColorId): BannerColor {
  return BANNER_COLORS.find((color) => color.id === id) ?? BANNER_COLORS[0];
}
