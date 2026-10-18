export interface TranslationItem {
	id: number;
	/** Telegram HTML subset in Russian. */
	html: string;
}

/** Turns Russian post HTML into English. */
export interface Translator {
	/** English HTML by id; failed items are left out. */
	translate(items: TranslationItem[]): Promise<Map<number, string>>;
	/** Suggests a short English slug for a Russian hashtag. */
	tagSlug(ru: string): Promise<string>;
}

const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]).sort();
const tagSeq = (html: string) => [...html.matchAll(/<\/?([a-z]+)/g)].map((m) => m[1]).join(',');

/** The translation kept the links and the tag sequence. */
export const sameMarkup = (ru: string, en: string) =>
	hrefs(ru).join('\n') === hrefs(en).join('\n') && tagSeq(ru) === tagSeq(en);
