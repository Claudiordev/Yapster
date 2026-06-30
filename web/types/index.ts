import { SVGProps } from "react";

export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

// --- Users -----------------------------------------------------------------
// The two kinds of user across the app, both keyed by a backend UUID `id`. The
// `type` field (a UserType enum) is the discriminant that says how to render
// and reach them. These mirror the shapes the backend will return once built.

/** Availability shown as the coloured dot on a normal user's avatar. */
export type Presence = "online" | "away" | "offline";

/** Discriminant for the two kinds of user. */
export enum UserType {
  Normal = "normal",
  Phone = "phone",
}

/**
 * A normal (web / VoIP) user: a real account with a display name, profile
 * picture and presence. Reached in-app over VoIP / messaging.
 */
export interface User {
  id: string;
  type: UserType.Normal;
  name: string;
  avatarUrl: string | null;
  presence: Presence;
}

/**
 * A phone (SMS) user: reached by phone number, which doubles as the display
 * name. No profile picture and no presence.
 */
export interface PhoneUser {
  id: string;
  type: UserType.Phone;
  phoneNumber: string;
}

/** Either kind of user that can appear in conversations and search. */
export type ChatUser = User | PhoneUser;
