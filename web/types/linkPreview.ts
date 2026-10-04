export interface LinkPreview {
  provider: "tiktok" | "twitter" | "site";
  url: string;
  /** Poster, or the site name for a generic link. */
  author: string;
  /** TikTok caption, tweet text, or a site's description. */
  text: string;
  /** Page title (generic links). */
  title?: string;
  /** Page image (og:image), loaded straight from its host by the reader's browser. */
  imageUrl?: string;
  /** The link itself is an image (served without a file extension). */
  directImage?: boolean;
  thumbnailUrl?: string;
  /** Photos of an X post (up to four), shown in full. */
  photoUrls?: string[];
  /** Playable video (X posts), shown with native controls. */
  videoUrl?: string;
  /** The post this one quotes, when there is one. */
  quote?: { author: string; text: string };
}
