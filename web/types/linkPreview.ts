export interface LinkPreview {
  provider: "tiktok" | "twitter";
  url: string;
  author: string;
  /** TikTok caption or tweet text. */
  text: string;
  thumbnailUrl?: string;
  /** Photos of an X post (up to four), shown in full. */
  photoUrls?: string[];
  /** Playable video (X posts), shown with native controls. */
  videoUrl?: string;
  /** The post this one quotes, when there is one. */
  quote?: { author: string; text: string };
}
