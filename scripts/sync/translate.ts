export interface TranslationItem {
	id: number;
	/** Telegram HTML subset in Russian. */
	html: string;
}

/** Anything that can turn Russian post HTML into English. Today that's Google Translate (google.ts). */
export interface Translator {
	/** Returns English HTML by id. Items that fail are left out of the result. */
	translate(items: TranslationItem[]): Promise<Map<number, string>>;
	/** Suggests a short English slug for a Russian hashtag. */
	tagSlug(ru: string): Promise<string>;
}

const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]).sort();
const tagSeq = (html: string) => [...html.matchAll(/<\/?([a-z]+)/g)].map((m) => m[1]).join(',');

/** True when the translation kept the markup: same links, same tags in the same order. */
export const sameMarkup = (ru: string, en: string) =>
	hrefs(ru).join('\n') === hrefs(en).join('\n') && tagSeq(ru) === tagSeq(en);
