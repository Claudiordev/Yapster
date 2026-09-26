/** The roles that get a badge next to a person's name, in display order. */
export const ROLE_BADGES = [
  { role: "ADMIN", label: "ADMIN", title: "Administrator", className: "call-role-badge--admin" },
  { role: "MODERATOR", label: "MOD", title: "Moderator", className: "call-role-badge--moderator" },
  { role: "PREMIUM_PLUS", label: "PREMIUM+", title: "Premium+ member", className: "call-role-badge--premium-plus" },
  { role: "PREMIUM", label: "PREMIUM", title: "Premium member", className: "call-role-badge--premium" },
] as const;

export type RoleBadgeInfo = (typeof ROLE_BADGES)[number];

/** The badges for the roles someone holds (empty for a plain USER). */
export function badgesForRoles(roles: readonly string[] | undefined): RoleBadgeInfo[] {
  return ROLE_BADGES.filter((badge) => roles?.includes(badge.role));
}
