export interface Gif {
  id: string;
  title: string;
  /** Small animated preview for the picker grid. */
  previewUrl: string;
  /** What gets sent as the message body. */
  url: string;
  width: number;
  height: number;
}

export interface GifPage {
  gifs: Gif[];
  hasNext: boolean;
}

export interface GifFolder {
  id: string;
  name: string;
  /** The built-in "Favorites" folder: can't be renamed or deleted. */
  isDefault: boolean;
  gifCount: number;
}

/** A GIF saved in a folder (our own copy of its links). */
export type SavedGif = Pick<Gif, "id" | "title" | "previewUrl" | "url">;

export interface GifLibrary {
  /** Favorites first. */
  folders: GifFolder[];
  /** gif id → ids of the folders that hold it. */
  memberships: Record<string, string[]>;
  /** Folders allowed beyond Favorites (0 without Premium). */
  maxExtraFolders: number;
  maxGifs: number;
}
