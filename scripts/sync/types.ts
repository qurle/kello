// Shapes shared by the sync steps. `PostFile` mirrors the schema in src/content.config.ts.

/** A media item as found in the preview, before download. */
export type ScrapedMedia =
	| {
			type: 'image';
			/** Message id of this album item. */
			messageId: number;
			url: string;
	  }
	| {
			type: 'video';
			messageId: number;
			/** Missing when the preview says "Media is too big". */
			url?: string;
			poster?: string;
			width?: number;
			height?: number;
	  };

export interface ScrapedPost {
	telegramId: number;
	date: string;
	/** Hashtags as written, lowercased, without `#`. */
	rawTags: string[];
	/** Sanitised HTML without the hashtag line and source URL; empty when there is no text. */
	html: string;
	link?: string;
	media: ScrapedMedia[];
}

export type MediaEntry =
	| { type: 'image'; messageId?: number; file: string; width: number; height: number; full?: boolean }
	| { type: 'video'; messageId?: number; file: string; poster?: string; width: number; height: number }
	| { type: 'unavailable'; messageId?: number; poster?: string; width?: number; height?: number };

export interface PostFile {
	telegramId: number;
	date: string;
	tags: string[];
	text?: { ru: string; en: string };
	sourceHash?: string;
	link?: string;
	media: MediaEntry[];
}
