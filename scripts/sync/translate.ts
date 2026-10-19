export interface TranslationItem {
	id: number
	/** Telegram HTML subset, in the channel's language */
	html: string
}

/** Turns post HTML in `translate.from` into `translate.to` */
export interface Translator {
	/** Translated HTML by id; failed items are left out */
	translate(items: TranslationItem[]): Promise<Map<number, string>>
	/** Translates a hashtag, for a slug */
	tagSlug(hashtag: string): Promise<string>
}

const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]).sort()
const tagSeq = (html: string) => [...html.matchAll(/<\/?([a-z]+)/g)].map((m) => m[1]).join(',')

/** The translation kept the links and the tag sequence */
export const sameMarkup = (source: string, translated: string) =>
	hrefs(source).join('\n') === hrefs(translated).join('\n') && tagSeq(source) === tagSeq(translated)
