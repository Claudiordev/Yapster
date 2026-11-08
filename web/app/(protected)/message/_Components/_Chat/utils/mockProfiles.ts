import type { UserStatus } from "@/types/chat";
import type { BannerColorId } from "@/types/user";

export interface MockPerson {
  id: string;
  name: string;
  subtitle: string;
  status?: UserStatus;
}

export interface MockProfile {
  customStatus: string;
  pronouns: string | null;
  bio: string;
  bannerColor: BannerColorId;
  memberSince: string;
  mutualFriends: MockPerson[];
  mutualServers: MockPerson[];
}

/**
 * TEMPORARY: fake extra profile data so the popup can be reviewed before the backend
 * serves these fields (see docs/profile-edit-backend-plan.md). Delete this file and its
 * use in UserProfileModal once GET /users/{id} returns the real values.
 */
const MOCKS: Record<string, MockProfile> = {
  sparrow: {
    customStatus: "Building something for my people.",
    pronouns: null,
    bio: "I’m developing this thing. A place to hang out, share a screen, and stay a little longer.",
    bannerColor: "graphite",
    memberSince: "2026-09-24T12:00:00Z",
    mutualFriends: [
      { id: "f1", name: "Baleinhas", subtitle: "Online", status: "online" },
      { id: "f2", name: "qauser", subtitle: "In The lounge", status: "online" },
      { id: "f3", name: "KurumiXD", subtitle: "Online", status: "online" },
      { id: "f4", name: "kurookami", subtitle: "Offline", status: "offline" },
    ],
    mutualServers: [
      { id: "s1", name: "Baleinhas", subtitle: "12 members" },
      { id: "s2", name: "Night Owls", subtitle: "48 members" },
      { id: "s3", name: "Ranked Grind", subtitle: "230 members" },
    ],
  },
};

/** The mock extras for a username, or null for everyone else. */
export function mockProfileFor(username: string | undefined): MockProfile | null {
  return MOCKS[(username ?? "").toLowerCase()] ?? null;
}
