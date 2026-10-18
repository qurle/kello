import { sameMarkup, type TranslationItem, type Translator } from './translate';

// The keyless endpoint behind Google Translate's web widget. Undocumented, so it can change or start
// refusing requests; the chain in translate.ts then hands the posts to the next provider.
// `format=html` keeps tags in place and accepts several `q` per request, returned in order.
const endpoint = 'https://translate.googleapis.com/translate_a/t?client=gtx&sl=ru&tl=en&format=html';
const wordEndpoint = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=ru&tl=en&dt=t&q=';

/** Text characters per request, kept well under the endpoint's limit. */
const maxChars = 4000;
const pause = 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cyrillic = /[а-яё]/i;

/**
 * Swaps each href for an index so URLs never reach the translator, and marks link text with no Cyrillic
 * (brand names, @mentions, URLs) and <code> as `translate="no"`.
 */
function protect(html: string) {
	const hrefs: string[] = [];
	const text = html
		.replace(/<a href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, (_, href: string, inner: string) => {
			const i = hrefs.push(href) - 1;
			return `<a i="${i}"${cyrillic.test(inner) ? '' : ' translate="no"'}>${inner}</a>`;
		})
		.replace(/<code>/g, '<code translate="no">');
	return { text, hrefs };
}

/** Puts the hrefs back and removes the spaces Google adds around tags. */
function restore(en: string, hrefs: string[]) {
	return en
		.replace(/<a\b[^>]*?\bi="?(\d+)"?[^>]*>/g, (_, i: string) => `<a href="${hrefs[Number(i)] ?? ''}">`)
		.replace(/<code[^>]*>/g, '<code>')
		.replace(/(<\/(?:a|b|i|u|s|code)>)\s+(?=[,.;:!?)»])/g, '$1')
		.replace(/(<br>|<blockquote>)\s+/g, '$1')
		.replace(/\s+(<br>|<\/blockquote>)/g, '$1')
		.trim();
}

/** Groups items so each request stays under `maxChars`. */
function batches<T extends { text: string }>(items: T[]) {
	const out: T[][] = [];
	let current: T[] = [];
	let size = 0;
	for (const item of items) {
		if (current.length && size + item.text.length > maxChars) {
			out.push(current);
			current = [];
			size = 0;
		}
		current.push(item);
		size += item.text.length;
	}
	if (current.length) out.push(current);
	return out;
}

export class GoogleTranslator implements Translator {
	private lastCall = 0;

	constructor(private warn: (msg: string) => void) {}

	/** Spaces requests out and retries rate limits and server errors a few times. */
	private async request(url: string, body?: string): Promise<unknown> {
		for (let attempt = 1; ; attempt++) {
			await sleep(Math.max(0, this.lastCall + pause - Date.now()));
			this.lastCall = Date.now();
			const res = await fetch(url, {
				method: body ? 'POST' : 'GET',
				headers: body ? { 'content-type': 'application/x-www-form-urlencoded;charset=utf-8' } : undefined,
				body,
			}).catch((err: Error) => err);
			if (!(res instanceof Error) && res.ok) return res.json();
			const reason = res instanceof Error ? res.message : `HTTP ${res.status}`;
			const retryable = res instanceof Error || res.status === 429 || res.status >= 500;
			if (!retryable || attempt >= 4) throw new Error(`Google Translate: ${reason}`);
			this.warn(`Google Translate: ${reason}, retrying in ${5 * attempt}s`);
			await sleep(5000 * attempt);
		}
	}

	async translate(items: TranslationItem[]): Promise<Map<number, string>> {
		const out = new Map<number, string>();
		const prepared = items.map((item) => ({ id: item.id, ru: item.html, ...protect(item.html) }));
		for (const batch of batches(prepared)) {
			let result: unknown;
			try {
				result = await this.request(endpoint, batch.map((b) => `q=${encodeURIComponent(b.text)}`).join('&'));
			} catch (err) {
				// Blocked or down: stop here; the rest keep their English and are retried next sync.
				this.warn((err as Error).message);
				break;
			}
			const texts = Array.isArray(result) ? result : [];
			batch.forEach((item, n) => {
				const raw = texts[n];
				const en = typeof raw === 'string' ? raw : Array.isArray(raw) ? String(raw[0]) : '';
				const html = en && restore(en, item.hrefs);
				if (html && sameMarkup(item.ru, html)) out.set(item.id, html);
				else this.warn(`post ${item.id}: Google Translate changed links or tags`);
			});
			console.log(`Translated ${out.size}/${items.length}`);
		}
		return out;
	}

	async tagSlug(ru: string): Promise<string> {
		const result = (await this.request(wordEndpoint + encodeURIComponent(ru))) as [[string][]];
		return result[0].map((s) => s[0]).join('');
	}
}
