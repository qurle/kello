import { GoogleGenAI } from '@google/genai';

export interface TranslationItem {
	id: number;
	/** Telegram HTML subset in Russian. */
	html: string;
}

/** Anything that can turn Russian post HTML into English. Gemini is the only implementation today. */
export interface Translator {
	/** Returns English HTML by id. Items that fail are left out of the result. */
	translate(items: TranslationItem[]): Promise<Map<number, string>>;
	/** Suggests a short English slug for a Russian hashtag. */
	tagSlug(ru: string): Promise<string>;
}

const prompt = `You translate posts of a Russian Telegram channel into English.

Input is a JSON array of {"id", "html"}. Return a JSON array of {"id", "html"} with the same ids, each html translated.

Rules:
- The html uses only <b>, <i>, <u>, <s>, <code>, <blockquote>, <br> and <a href="…">. Keep every tag, in the same order, and keep every href exactly as it is. Translate only the text between tags.
- Keep the same number of <br>.
- Keep @mentions, URLs, product, company and font names as written. Write people's names in their usual English spelling.
- Write natural, concise English in the same casual tone. Do not add, explain or drop anything.`;

const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]).sort();
const tagSeq = (html: string) => [...html.matchAll(/<\/?([a-z]+)/g)].map((m) => m[1]).join(',');

/** True when the translation kept the markup: same links, same tags in the same order. */
export const sameMarkup = (ru: string, en: string) =>
	hrefs(ru).join('\n') === hrefs(en).join('\n') && tagSeq(ru) === tagSeq(en);

const isFatal = (err: unknown) => {
	const status = (err as { status?: number }).status;
	const message = (err as Error).message ?? '';
	return status === 401 || status === 403 || /PerDay|API key|location is not supported/i.test(message);
};

/** The API's own message out of the JSON error body the SDK puts in `message`. */
const errorText = (err: unknown) => {
	const message = (err as Error).message ?? String(err);
	try {
		return JSON.parse(message).error.message as string;
	} catch {
		return message.slice(0, 300);
	}
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface GeminiOptions {
	apiKey: string;
	model: string;
	instructions?: string;
	/** Posts per request. Fewer, larger requests suit the free tier's per-minute limit. */
	batchSize?: number;
	warn: (msg: string) => void;
}

export class GeminiTranslator implements Translator {
	private ai: GoogleGenAI;
	private lastCall = 0;

	constructor(private opts: GeminiOptions) {
		this.ai = new GoogleGenAI({ apiKey: opts.apiKey });
	}

	/** Spaces requests out and retries rate-limit and server errors, honouring the suggested delay. */
	private async generate(contents: string, system: string, schema?: object): Promise<string> {
		for (let attempt = 1; ; attempt++) {
			await sleep(Math.max(0, this.lastCall + 6500 - Date.now()));
			this.lastCall = Date.now();
			try {
				const res = await this.ai.models.generateContent({
					model: this.opts.model,
					contents,
					config: {
						systemInstruction: system,
						temperature: 0.2,
						...(schema && { responseMimeType: 'application/json', responseJsonSchema: schema }),
					},
				});
				const text = res.text;
				if (!text) throw new Error(`empty response (${res.candidates?.[0]?.finishReason ?? 'no candidates'})`);
				return text;
			} catch (err) {
				const status = (err as { status?: number }).status;
				const message = (err as Error).message ?? String(err);
				const retryable = status === 429 || (status !== undefined && status >= 500) || /fetch failed|ECONNRESET/i.test(message);
				// Daily quota: retrying won't help until tomorrow.
				if (!retryable || attempt >= 5 || isFatal(err)) throw err;
				const delay = Number(message.match(/retryDelay"?:\s*"?(\d+)/)?.[1]) || 10 * attempt;
				this.opts.warn(`Gemini ${status ?? 'error'}, retrying in ${delay}s`);
				await sleep(delay * 1000);
			}
		}
	}

	private async translateBatch(items: TranslationItem[]): Promise<Map<number, string>> {
		const schema = {
			type: 'array',
			items: {
				type: 'object',
				properties: { id: { type: 'integer' }, html: { type: 'string' } },
				required: ['id', 'html'],
			},
		};
		const system = [prompt, this.opts.instructions].filter(Boolean).join('\n\n');
		const text = await this.generate(JSON.stringify(items), system, schema);
		const parsed = JSON.parse(text) as { id: number; html: string }[];
		return new Map(parsed.map((p) => [p.id, p.html.trim()]));
	}

	async translate(items: TranslationItem[]): Promise<Map<number, string>> {
		const out = new Map<number, string>();
		const size = this.opts.batchSize ?? 15;
		const retry: TranslationItem[] = [];
		for (let i = 0; i < items.length; i += size) {
			const batch = items.slice(i, i + size);
			try {
				const result = await this.translateBatch(batch);
				for (const item of batch) {
					const en = result.get(item.id);
					if (en && sameMarkup(item.html, en)) out.set(item.id, en);
					else retry.push(item);
				}
			} catch (err) {
				this.opts.warn(`Translation batch failed: ${errorText(err)}`);
				// Out of daily quota, bad key or unsupported region: no point trying item by item.
				if (isFatal(err)) return out;
				retry.push(...batch);
			}
			console.log(`Translated ${out.size}/${items.length}`);
		}
		// One more try for each item that failed or came back with broken markup, alone this time.
		for (const item of retry) {
			try {
				const en = (await this.translateBatch([item])).get(item.id);
				if (en && sameMarkup(item.html, en)) out.set(item.id, en);
				else this.opts.warn(`post ${item.id}: translation changed links or tags, kept for the next sync`);
			} catch (err) {
				this.opts.warn(`post ${item.id}: translation failed: ${errorText(err)}`);
				if (isFatal(err)) break;
			}
		}
		return out;
	}

	async tagSlug(ru: string): Promise<string> {
		const text = await this.generate(
			`#${ru}`,
			'You name tags for a design blog. Reply with one short English slug for this Russian hashtag: lowercase latin letters, digits and hyphens only, usually a single word. Reply with the slug only.',
		);
		return text.trim();
	}
}
