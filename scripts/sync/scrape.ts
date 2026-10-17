import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { parseText } from './html';
import type { ScrapedMedia, ScrapedPost } from './types';

const userAgent =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

export interface Page {
	posts: ScrapedPost[];
	/** Pass as `?before=` to get the next older page. Missing on the oldest page. */
	before?: number;
}

const backgroundUrl = (style = '') => style.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/)?.[1];

const idFromHref = (href = '') => {
	const id = href.match(/\/(\d+)(?:\?|$)/)?.[1];
	return id ? Number(id) : undefined;
};

export function parsePage(html: string): Page {
	const $ = cheerio.load(html);
	const posts: ScrapedPost[] = [];

	$('.tgme_widget_message[data-post]').each((_, el) => {
		const message = $(el);
		// "Channel created", pinned-message notices and the like.
		if (message.hasClass('service_message')) return;
		const telegramId = Number(message.attr('data-post')!.split('/')[1]);
		const date = message.find('.tgme_widget_message_date time[datetime]').attr('datetime');
		if (!telegramId || !date) return;

		// The text block is sometimes nested in a second `.js-message_text`; a reply quote has its own text block.
		const textEl = message
			.find('.js-message_text')
			.filter((_, t) => $(t).closest('.tgme_widget_message_reply').length === 0)
			.last()
			.get(0) as Element | undefined;
		const { tags, html: text, link } = parseText(textEl);

		const media: ScrapedMedia[] = [];
		message
			.find('.tgme_widget_message_photo_wrap, .tgme_widget_message_video_player')
			.filter((_, m) => $(m).closest('.tgme_widget_message_reply').length === 0)
			.each((_, m) => {
				const item = $(m);
				const messageId = idFromHref(item.attr('href')) ?? telegramId;
				if (item.hasClass('tgme_widget_message_photo_wrap')) {
					const url = backgroundUrl(item.attr('style'));
					if (url) media.push({ type: 'image', messageId, url });
					return;
				}
				// `style="width:3018px;padding-top:48.5%"` holds the video's real size.
				const wrapStyle = item.find('.tgme_widget_message_video_wrap').attr('style') ?? '';
				const width = Number(wrapStyle.match(/width:\s*(\d+)px/)?.[1]) || undefined;
				const ratio = Number(wrapStyle.match(/padding-top:\s*([\d.]+)%/)?.[1]) || undefined;
				media.push({
					type: 'video',
					messageId,
					url: item.find('video[src]').attr('src'),
					poster: backgroundUrl(item.find('.tgme_widget_message_video_thumb').attr('style')),
					width,
					height: width && ratio ? Math.round((width * ratio) / 100) : undefined,
				});
			});

		posts.push({
			telegramId,
			date: new Date(date).toISOString(),
			rawTags: tags,
			html: text,
			link,
			media,
		});
	});

	const before = Number($('.tme_messages_more[data-before]').first().attr('data-before')) || undefined;
	// Guard against a page that links to itself.
	const oldest = Math.min(...posts.map((p) => p.telegramId));
	return { posts, before: before && before <= oldest ? before : undefined };
}

async function fetchPage(channel: string, before?: number): Promise<string> {
	const url = `https://t.me/s/${channel}${before ? `?before=${before}` : ''}`;
	for (let attempt = 1; ; attempt++) {
		try {
			const res = await fetch(url, { headers: { 'user-agent': userAgent, 'accept-language': 'en' } });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return await res.text();
		} catch (err) {
			if (attempt >= 4) throw new Error(`Failed to fetch ${url}: ${(err as Error).message}`);
			await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
		}
	}
}

export interface ScrapeResult {
	posts: ScrapedPost[];
	/** True when the walk reached the first post of the channel. */
	reachedStart: boolean;
}

/** Reads `pages` pages from newest to oldest; `Infinity` walks the whole channel. */
export async function scrape(channel: string, pages: number): Promise<ScrapeResult> {
	const byId = new Map<number, ScrapedPost>();
	let before: number | undefined;
	for (let i = 0; i < pages; i++) {
		const page = parsePage(await fetchPage(channel, before));
		for (const post of page.posts) {
			// An album cut by a page boundary can show up twice; keep the fuller copy.
			const seen = byId.get(post.telegramId);
			if (!seen || post.media.length > seen.media.length) byId.set(post.telegramId, post);
		}
		process.stdout.write(`\rScraped ${i + 1} page(s), ${byId.size} posts`);
		if (!page.before) {
			process.stdout.write('\n');
			return { posts: [...byId.values()].sort((a, b) => b.telegramId - a.telegramId), reachedStart: true };
		}
		before = page.before;
		await new Promise((r) => setTimeout(r, 400));
	}
	process.stdout.write('\n');
	return { posts: [...byId.values()].sort((a, b) => b.telegramId - a.telegramId), reachedStart: false };
}
