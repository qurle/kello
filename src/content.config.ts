import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

const media = z.object({
	type: z.union([z.literal("image"), z.literal("video")]),
	url: z.string().url()
})

const posts = defineCollection({
	loader: glob({ pattern: '**/[^_]*.{json,md,mdx}', base: "/src/data/posts" }),
	schema: z.object({
		telegramId: z.number(),
		date: z.date(),
		tags: z.array(z.string()).optional(),
		text: z.string().optional(),
		link: z.string().url().optional(),
		media: z.array(media).optional(),
		fullText: z.string().optional(),
	})
})

export const collections = { posts };