// Hand-written fixes on top of synced posts, applied by `getPosts()`. Sync never touches this file.
// Keyed by `telegramId`. A `text.en` override wins even after the post is edited in Telegram.
//
//   213: { hidden: true },
//   248: { tags: ['learning', 'design-engineering'] },
//   320: { text: { en: 'Same HTML subset as synced text.' } },

export interface PostOverride {
	/** Leaves the post out */
	hidden?: boolean
	/** Replaces the tags (English slugs) */
	tags?: string[]
	text?: {
		/** Replaces the English text */
		en?: string
	}
}

export type Overrides = Record<number, PostOverride>

export const overrides: Overrides = {
	// The channel's pinned hashtag index
	21: { hidden: true },
}
