import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

// Image and poster paths have no width or extension (`338/1` is `338/1-800.webp` and so on): see `imageSources()`

/** The album item's own Telegram message id */
const messageId = z.number().optional()

const image = z.object({
	type: z.literal('image'),
	messageId,
	file: z.string(),
	width: z.number(),
	height: z.number(),
	/** Telegram's largest copy, fetched through the bot */
	full: z.boolean().optional(),
})

const video = z.object({
	type: z.literal('video'),
	messageId,
	/** Full file name, e.g. `338/2.mp4` */
	file: z.string(),
	poster: z.string().optional(),
	width: z.number(),
	height: z.number(),
})

// Not in the preview, or over `media.maxVideoMB`: a poster linking to Telegram
const unavailable = z.object({
	type: z.literal('unavailable'),
	messageId,
	poster: z.string().optional(),
	width: z.number().optional(),
	height: z.number().optional(),
})

/** HTML subset without hashtags and source link, by language code: the original, and the translation */
const text = z.record(z.string(), z.string())

// Written by `npm run sync`: src/data/posts/<telegramId>.json
const posts = defineCollection({
	loader: glob({ pattern: '**/[^_]*.json', base: './src/data/posts' }),
	schema: z.object({
		/** First message id; albums take one id per item */
		telegramId: z.number(),
		date: z.coerce.date(),
		/** English slugs */
		tags: z.array(z.string()),
		text: text.optional(),
		/** Hash of the original text when translated; a mismatch re-translates */
		sourceHash: z.string().optional(),
		/** The post's source link */
		link: z.string().url().optional(),
		media: z.array(z.discriminatedUnion('type', [image, video, unavailable])).default([]),
	}),
})

export const collections = { posts }
