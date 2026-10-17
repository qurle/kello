import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Media paths are relative to `public/<media.dir>` and have no width or extension:
// `338/1` resolves to `338/1-960.avif`, `338/1-960.webp` and so on. Which widths exist depends on the
// original size: use `imageSources()` from src/lib/media.ts. Posters follow the same rule (`338/2-poster`).

/** Telegram message id of the album item, for links like `t.me/<channel>/<messageId>?single`. */
const messageId = z.number().optional();

const image = z.object({
	type: z.literal('image'),
	messageId,
	file: z.string(),
	width: z.number(),
	height: z.number(),
});

const video = z.object({
	type: z.literal('video'),
	messageId,
	/** Full file name, e.g. `338/2.mp4`. */
	file: z.string(),
	poster: z.string().optional(),
	width: z.number(),
	height: z.number(),
});

// Too large for the web preview or above `media.maxVideoMB`: shown as a poster linking to Telegram.
const unavailable = z.object({
	type: z.literal('unavailable'),
	messageId,
	poster: z.string().optional(),
	width: z.number().optional(),
	height: z.number().optional(),
});

const text = z.object({
	/** Telegram HTML subset (b, i, u, s, a, code, blockquote, br), hashtags and source link removed. */
	ru: z.string(),
	en: z.string(),
});

// Written by `npm run sync`, one file per post: src/data/posts/<telegramId>.json
const posts = defineCollection({
	loader: glob({ pattern: '**/[^_]*.json', base: './src/data/posts' }),
	schema: z.object({
		/** First message id; albums take one id per item. */
		telegramId: z.number(),
		date: z.coerce.date(),
		/** English slugs from kello.config.ts. */
		tags: z.array(z.string()),
		text: text.optional(),
		/** Hash of `text.ru` at translation time; a mismatch triggers re-translation. */
		sourceHash: z.string().optional(),
		/** Main external link of the post. */
		link: z.string().url().optional(),
		media: z.array(z.discriminatedUnion('type', [image, video, unavailable])).default([]),
	}),
});

export const collections = { posts };
