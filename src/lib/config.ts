import { z } from 'astro/zod';

const tag = z.object({
	/** Hashtag as written in Telegram, without `#`. */
	ru: z.string(),
	/** URL-safe English slug, used in `?tags=` and as the stable key on the site. */
	en: z.string().regex(/^[a-z0-9-]+$/),
	/** Label shown on the English site. Defaults to `en`. Tags are always lowercase. */
	label: z
		.string()
		.refine((label) => label === label.toLowerCase(), 'Tag labels are lowercase')
		.optional(),
	/** Other spellings (typos, singular forms) that map to this tag. */
	aliases: z.array(z.string()).default([]),
	/** Keep the tag on posts but leave it out of the filter line. */
	hidden: z.boolean().default(false),
});

export const configSchema = z.object({
	site: z.object({
		title: z.string(),
		url: z.string().url(),
	}),
	channel: z.object({
		/** Public channel username, as in `t.me/s/<username>`. */
		username: z.string(),
		/** Pages (~20 messages each) re-checked on a regular sync to catch edits and deletions. */
		recentPages: z.number().int().positive(),
		/**
		 * Optional Telegram bot for full-size photos (scripts/sync/bot.ts). Environment variables holding
		 * its token and the id of the private chat it forwards into; without both, sync uses the web
		 * preview's 800px copies.
		 */
		bot: z.object({
			tokenEnv: z.string(),
			dumpChatEnv: z.string(),
		}),
	}),
	media: z.object({
		/** Output folder under `public/`. */
		dir: z.string(),
		/** Image widths generated at sync time, in px. */
		widths: z.array(z.number().int().positive()),
		formats: z.array(z.enum(['avif', 'webp'])),
		/** WebP quality, 1–100. */
		quality: z.number().int().min(1).max(100),
		/** Videos above this size are not downloaded; the post links to Telegram instead. */
		maxVideoMB: z.number().positive(),
	}),
	/** Tag taxonomy, in filter-line order. Tags missing here are flagged by sync. */
	tags: z.array(tag),
});

export type KelloConfig = z.input<typeof configSchema>;

export const defineConfig = (config: KelloConfig) => configSchema.parse(config);
