import { z } from 'astro/zod';

const tag = z.object({
	/** Hashtag without `#`. */
	ru: z.string(),
	/** URL slug, used in `?tags=`. */
	en: z.string().regex(/^[a-z0-9-]+$/),
	/** Label on the English site; defaults to `en`. */
	label: z
		.string()
		.refine((label) => label === label.toLowerCase(), 'Tag labels are lowercase')
		.optional(),
	/** Other spellings that map to this tag. */
	aliases: z.array(z.string()).default([]),
	/** On posts, but not in the filter line. */
	hidden: z.boolean().default(false),
});

const subtitleLine = z.object({ text: z.string(), link: z.string() });

export const configSchema = z.object({
	site: z.object({
		title: z.string(),
		url: z.string().url(),
		subtitle: z
			.object({
				en: subtitleLine,
				ru: subtitleLine.optional(),
				url: z.string().url(),
			})
			.optional(),
		pageSize: z.number().int().positive(),
	}),
	channel: z.object({
		/** Public channel username, as in `t.me/s/<username>`. */
		username: z.string(),
		/** Pages (~20 messages each) a regular sync re-reads. */
		recentPages: z.number().int().positive(),
		/** Environment variables for the full-size photo bot (scripts/sync/bot.ts); without both, photos stay 800px. */
		bot: z.object({
			tokenEnv: z.string(),
			dumpChatEnv: z.string(),
		}),
	}),
	media: z.object({
		/** Folder under `public/`. */
		dir: z.string(),
		/** Image widths in px. */
		widths: z.array(z.number().int().positive()),
		formats: z.array(z.enum(['avif', 'webp'])),
		/** WebP quality, 1–100. */
		quality: z.number().int().min(1).max(100),
		/** Larger videos link to Telegram instead. */
		maxVideoMB: z.number().positive(),
	}),
	/** In filter-line order. */
	tags: z.array(tag),
});

export type KelloConfig = z.input<typeof configSchema>;

export const defineConfig = (config: KelloConfig) => configSchema.parse(config);
