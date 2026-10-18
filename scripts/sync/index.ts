// npm run sync [-- --full] [-- --no-translate] [-- --allow-mass-delete] [-- --message <file>]
//   --full               walk the whole channel and delete what is gone from it
//   --no-translate       English = Russian, without `sourceHash`, so a later sync translates
//   --allow-mass-delete  delete even if implausibly many posts vanished
//   --message <file>     write a commit message summarising the run
import './env';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import config from '../../kello.config';
import { TelegramBot } from './bot';
import { removeMedia, syncMedia, type MediaOptions } from './media';
import { scrape } from './scrape';
import { readPosts, removePost, writePost } from './store';
import { TagMapper } from './tags';
import { GoogleTranslator } from './google';
import type { Translator } from './translate';
import type { PostFile, ScrapedPost } from './types';

const args = process.argv.slice(2);
const full = args.includes('--full');
const noTranslate = args.includes('--no-translate');
const allowMassDelete = args.includes('--allow-mass-delete');
const messageFile = args.includes('--message') ? args[args.indexOf('--message') + 1] : undefined;

const warnings: string[] = [];
const warn = (msg: string) => {
	warnings.push(msg);
	console.warn(`! ${msg}`);
};

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** Runs `fn` over `items` with at most `limit` in flight. */
async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
	const queue = [...items];
	await Promise.all(
		Array.from({ length: limit }, async () => {
			while (queue.length) await fn(queue.shift()!);
		}),
	);
}

/** The full-size photo bot, if configured and able to see both chats. */
async function connectBot(): Promise<TelegramBot | undefined> {
	const token = process.env[config.channel.bot.tokenEnv];
	const dumpChat = process.env[config.channel.bot.dumpChatEnv];
	if (!token || !dumpChat) {
		console.log(`${config.channel.bot.tokenEnv} or ${config.channel.bot.dumpChatEnv} is not set, photos stay at the web preview's size.`);
		return undefined;
	}
	const bot = new TelegramBot(token, config.channel.username, dumpChat, warn);
	try {
		console.log(`Telegram bot @${await bot.check()} ready for full-size photos.`);
		return bot;
	} catch (err) {
		warn(`Telegram bot not usable, photos stay at the web preview's size: ${(err as Error).message}`);
		return undefined;
	}
}

async function main() {
	const mediaOpts: MediaOptions = {
		root: path.resolve('public', config.media.dir),
		widths: config.media.widths,
		formats: config.media.formats,
		quality: config.media.quality,
		maxVideoMB: config.media.maxVideoMB,
		bot: await connectBot(),
	};

	const translator: Translator | undefined = noTranslate ? undefined : new GoogleTranslator(warn);

	const existing = await readPosts();
	const tags = new TagMapper(config.tags, translator);
	await tags.load();

	const { posts: scraped, reachedStart } = await scrape(config.channel.username, full ? Infinity : config.channel.recentPages);
	if (!scraped.length) throw new Error('No posts found in the web preview. Has the markup changed?');

	// On a partial walk the oldest post may be an album cut by the page boundary: leave it alone.
	const boundary = reachedStart ? undefined : scraped.at(-1)!.telegramId;
	const current = boundary === undefined ? scraped : scraped.filter((p) => p.telegramId > boundary);

	// Media and tags, three posts at a time.
	const drafts = new Map<number, PostFile>();
	console.log(`Syncing media for ${current.length} posts`);
	await pool(current, 3, async (post: ScrapedPost) => {
		const prev = existing.get(post.telegramId);
		try {
			const media = await syncMedia(post, prev?.media, mediaOpts, warn);
			drafts.set(post.telegramId, {
				telegramId: post.telegramId,
				date: post.date,
				tags: await tags.map(post.rawTags),
				text: post.html ? { ru: post.html, en: '' } : undefined,
				link: post.link,
				media,
			});
		} catch (err) {
			warn(`post ${post.telegramId}: ${(err as Error).message}${prev ? ', kept the previous version' : ', skipped'}`);
		}
	});

	// Reuse translations whose source is unchanged, translate the rest.
	const pending: PostFile[] = [];
	for (const draft of drafts.values()) {
		if (!draft.text) continue;
		const prev = existing.get(draft.telegramId);
		const hash = sha256(draft.text.ru);
		if (prev?.sourceHash === hash && prev.text?.en) {
			draft.text.en = prev.text.en;
			draft.sourceHash = hash;
		} else {
			pending.push(draft);
		}
	}
	let translated = 0;
	if (pending.length) {
		let result = new Map<number, string>();
		try {
			if (translator) result = await translator.translate(pending.map((d) => ({ id: d.telegramId, html: d.text!.ru })));
		} catch (err) {
			// A failing translator never fails the sync.
			warn(`Translation failed: ${(err as Error).message}`);
		}
		for (const draft of pending) {
			const en = result.get(draft.telegramId);
			const prev = existing.get(draft.telegramId);
			if (en) {
				draft.text!.en = en;
				draft.sourceHash = sha256(draft.text!.ru);
				translated++;
			} else {
				// Keep the old English, else the Russian; the stale hash makes the next sync retry.
				draft.text!.en = (!noTranslate && prev?.text?.en) || draft.text!.ru;
				draft.sourceHash = noTranslate ? undefined : prev?.sourceHash;
			}
		}
		if (translator && translated < pending.length) warn(`${pending.length - translated} post(s) left untranslated`);
	}

	let added = 0;
	let updated = 0;
	for (const draft of [...drafts.values()].sort((a, b) => a.telegramId - b.telegramId)) {
		if (await writePost(draft)) existing.has(draft.telegramId) ? updated++ : added++;
	}

	// Deletions: whatever the walk covered that is gone from Telegram.
	const seen = new Set(scraped.map((p) => p.telegramId));
	const gone = [...existing.keys()].filter((id) => !seen.has(id) && (boundary === undefined || id > boundary));
	const limit = Math.max(10, Math.ceil(existing.size * 0.2));
	const refuse = gone.length > limit && !allowMassDelete;
	if (refuse) {
		warn(`${gone.length} posts are missing from Telegram, more than the limit of ${limit}. Not deleting; rerun with --allow-mass-delete if this is real.`);
	} else {
		for (const id of gone) {
			await removePost(id);
			await removeMedia(id, mediaOpts);
		}
		// A full walk also clears media folders without a post.
		if (full) {
			const keep = new Set([...drafts.keys(), ...existing.keys()].filter((id) => !gone.includes(id)).map(String));
			for (const dir of await fs.readdir(mediaOpts.root).catch(() => [] as string[])) {
				if (/^\d+$/.test(dir) && !keep.has(dir)) await fs.rm(path.join(mediaOpts.root, dir), { recursive: true, force: true });
			}
		}
	}
	const deleted = refuse ? 0 : gone.length;

	await tags.save();

	const counts = [added && `${added} new`, updated && `${updated} updated`, deleted && `${deleted} deleted`].filter(Boolean);
	const lines = [`Sync: ${counts.join(', ') || 'no post changes'}`];
	const body: string[] = [];
	if (translated) body.push(`Translated ${translated} post(s).`);
	if (tags.unknown.size) {
		body.push('', 'Tags missing from kello.config.ts (add them with a label):');
		for (const [ru, en] of tags.unknown) body.push(`- #${ru} → ${en}`);
	}
	if (warnings.length) {
		body.push('', 'Warnings:');
		for (const w of warnings) body.push(`- ${w}`);
	}
	if (body.length) lines.push('', ...body);
	const message = lines.join('\n').replace(/\n{3,}/g, '\n\n');
	console.log(`\n${message}`);
	if (messageFile) await fs.writeFile(messageFile, message + '\n');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
