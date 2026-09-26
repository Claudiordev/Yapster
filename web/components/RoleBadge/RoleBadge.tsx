import type { RoleBadgeInfo } from "@/lib/roleBadges";

interface RoleBadgeProps {
  badge: RoleBadgeInfo;
  /** Whose badge this is, for screen readers ("Maya is a moderator"). */
  ownerName?: string;
}

/** A role pill (ADMIN / MOD / PREMIUM). */
export function RoleBadge({ badge, ownerName }: RoleBadgeProps) {
  return (
    <span
      aria-label={ownerName ? `${ownerName} is a ${badge.title.toLowerCase()}` : undefined}
      className={`call-role-badge ${badge.className}`}
      title={badge.title}
    >
      {badge.label}
    </span>
  );
}
