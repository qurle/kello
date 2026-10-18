// Hand-written fixes on top of the synced posts. `npm run sync` never reads or writes this file;
// overrides are applied at build time by `getPosts()` in src/lib/posts.ts.
//
// Key: the post's `telegramId` (the number in t.me/the_kello/<id>, and in src/data/posts/<id>.json).
//
//   export const overrides: Overrides = {
//   	// Hide a post from the site.
//   	213: { hidden: true },
//   	// Replace the tags. EN slugs from kello.config.ts.
//   	248: { tags: ['learning', 'design-engineering'] },
//   	// Replace a bad machine translation. Same HTML subset as the synced text.
//   	320: { text: { en: 'PsiQuantum builds hardware for quantum computers…' } },
//   };
//
// An override on a post that no longer exists does nothing. Remove it when the fix is no longer needed:
// a `text.en` override wins even after the post is edited in Telegram.

export interface PostOverride {
	/** Leave the post out of the site. */
	hidden?: boolean;
	/** Replaces the post's tags. */
	tags?: string[];
	text?: {
		/** Replaces the English text. */
		en?: string;
	};
}

export type Overrides = Record<number, PostOverride>;

export const overrides: Overrides = {
	// The channel's pinned hashtag index ("🧭 Navigation"): the site has its own tag line.
	21: { hidden: true },
};
