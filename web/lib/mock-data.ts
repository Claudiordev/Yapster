import { UserType, type PhoneUser, type User } from "@/types";

/**
 * Central home for everything we mock while features are stubbed ahead of their
 * backend. As each endpoint lands, replace the matching export with a real API
 * call and delete it from here — keeping all the fake data in one file makes
 * that easy to track.
 */

// --- User directory (header search) ----------------------------------------
// Normal (web) users discoverable in the new-conversation search. Friendship is
// kept separately in MOCK_FRIEND_IDS because the real backend returns it per
// viewer, not as a property of the user. avatarUrl is null so they fall back to
// the initial-letter avatar until real pictures exist.
export const MOCK_USERS: User[] = [
  { id: "f47ac10b-58cc-4372-a567-0e02b2c3d401", type: UserType.Normal, name: "Alice Carter", avatarUrl: null, presence: "online" },
  { id: "f47ac10b-58cc-4372-a567-0e02b2c3d402", type: UserType.Normal, name: "Ben Ortiz", avatarUrl: null, presence: "away" },
  { id: "f47ac10b-58cc-4372-a567-0e02b2c3d403", type: UserType.Normal, name: "Chloe Nguyen", avatarUrl: null, presence: "offline" },
  { id: "f47ac10b-58cc-4372-a567-0e02b2c3d404", type: UserType.Normal, name: "Marcus Lee", avatarUrl: null, presence: "online" },
  { id: "f47ac10b-58cc-4372-a567-0e02b2c3d405", type: UserType.Normal, name: "Priya Shah", avatarUrl: null, presence: "online" },
  { id: "f47ac10b-58cc-4372-a567-0e02b2c3d406", type: UserType.Normal, name: "Diego Santos", avatarUrl: null, presence: "online" },
  { id: "f47ac10b-58cc-4372-a567-0e02b2c3d407", type: UserType.Normal, name: "Emma Wilson", avatarUrl: null, presence: "away" },
  { id: "f47ac10b-58cc-4372-a567-0e02b2c3d408", type: UserType.Normal, name: "Farah Khan", avatarUrl: null, presence: "offline" },
  { id: "f47ac10b-58cc-4372-a567-0e02b2c3d409", type: UserType.Normal, name: "Grace Park", avatarUrl: null, presence: "online" },
  { id: "f47ac10b-58cc-4372-a567-0e02b2c3d40a", type: UserType.Normal, name: "Hugo Martin", avatarUrl: null, presence: "away" },
  { id: "f47ac10b-58cc-4372-a567-0e02b2c3d40b", type: UserType.Normal, name: "Isla Brooks", avatarUrl: null, presence: "offline" },
  { id: "f47ac10b-58cc-4372-a567-0e02b2c3d40c", type: UserType.Normal, name: "Jamal Reed", avatarUrl: null, presence: "online" },
  { id: "f47ac10b-58cc-4372-a567-0e02b2c3d40d", type: UserType.Normal, name: "Karen Diaz", avatarUrl: null, presence: "away" },
  { id: "f47ac10b-58cc-4372-a567-0e02b2c3d40e", type: UserType.Normal, name: "Liam Foster", avatarUrl: null, presence: "offline" },
  { id: "f47ac10b-58cc-4372-a567-0e02b2c3d40f", type: UserType.Normal, name: "Nina Volkov", avatarUrl: null, presence: "online" },
  { id: "f47ac10b-58cc-4372-a567-0e02b2c3d410", type: UserType.Normal, name: "Omar Haddad", avatarUrl: null, presence: "away" },
];

/** Which directory users are already your friends (would come from a friends API). */
export const MOCK_FRIEND_IDS = new Set<string>([
  "f47ac10b-58cc-4372-a567-0e02b2c3d401",
  "f47ac10b-58cc-4372-a567-0e02b2c3d402",
  "f47ac10b-58cc-4372-a567-0e02b2c3d403",
  "f47ac10b-58cc-4372-a567-0e02b2c3d404",
  "f47ac10b-58cc-4372-a567-0e02b2c3d405",
]);

// --- Phone (SMS) users -----------------------------------------------------
// Mock phone contacts so the search shows phone-user rows (phone icon, number
// as the name, no presence) without needing real SMS conversations. The real
// app sources these from your actual conversations instead. All are treated as
// contacts (friends) — you reach a phone user by texting the number, you don't
// send them a friend request.
export const MOCK_PHONE_USERS: PhoneUser[] = [
  { id: "f47ac10b-58cc-4372-a567-0e02b2c3d501", type: UserType.Phone, phoneNumber: "+1 202 555 0173" },
  { id: "f47ac10b-58cc-4372-a567-0e02b2c3d502", type: UserType.Phone, phoneNumber: "+1 415 555 0142" },
  { id: "f47ac10b-58cc-4372-a567-0e02b2c3d503", type: UserType.Phone, phoneNumber: "+1 310 555 0128" },
  { id: "f47ac10b-58cc-4372-a567-0e02b2c3d504", type: UserType.Phone, phoneNumber: "+1 617 555 0195" },
  { id: "f47ac10b-58cc-4372-a567-0e02b2c3d505", type: UserType.Phone, phoneNumber: "+1 773 555 0164" },
];
