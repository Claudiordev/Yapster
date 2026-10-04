import type { UserStatus } from "@/types/chat";

/** Feature name → switched on, as set by an admin (see GET /features). */
export type FeatureFlags = Record<string, boolean>;

/** The signed-in user, as seeded on the server (see getAccount). */
export interface Account {
  userId: string;
  username: string;
  balance: number;
  avatarUrl: string | null;
  roles: string[];
  features: FeatureFlags;
}

/** The signed-in user as the session service returns it from `GET /user`. */
export interface SessionUser {
  id: string;
  username: string;
  balance?: number;
  avatarUrl?: string | null;
  roles?: string[];
}

/** A platform user as listed/searched (never carries email or password). */
export interface PlatformUser {
  id: string;
  username: string;
  avatarUrl: string | null;
  roles: string[];
}

/** A platform user's public profile card: the listing shape plus their bio. */
export interface UserProfileData extends PlatformUser {
  bio: string | null;
}

/** Display identity for a person in the UI, resolved from conversation members. */
export interface UserIdentity {
  name: string;
  avatarUrl: string | null;
  roles: string[];
  /** Absent when we have no live presence (e.g. the local user, tracked by useMyStatus). */
  status?: UserStatus;
}

/** A person opened in the profile popup; `id` is used to fetch their live profile. */
export interface UserProfile extends UserIdentity {
  id: string;
}

/** A login provider (e.g. Google) linked to the current user. */
export interface LinkedProvider {
  provider: string;
  email: string | null;
  linkedAt: string;
}
