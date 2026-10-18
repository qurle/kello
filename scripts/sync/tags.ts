import fs from 'node:fs/promises'
import type { KelloConfig } from '../../src/lib/config'
import type { Translator } from './translate'

type Tag = KelloConfig['tags'][number]

// Slugs suggested for hashtags missing from the config, kept so they stay stable. Dropped once the config has the tag
export const suggestionsFile = 'src/data/tag-suggestions.json'

const translit: Record<string, string> = {
	а: 'a',
	б: 'b',
	в: 'v',
	г: 'g',
	д: 'd',
	е: 'e',
	ё: 'e',
	ж: 'zh',
	з: 'z',
	и: 'i',
	й: 'y',
	к: 'k',
	л: 'l',
	м: 'm',
	н: 'n',
	о: 'o',
	п: 'p',
	р: 'r',
	с: 's',
	т: 't',
	у: 'u',
	ф: 'f',
	х: 'h',
	ц: 'ts',
	ч: 'ch',
	ш: 'sh',
	щ: 'sch',
	ъ: '',
	ы: 'y',
	ь: '',
	э: 'e',
	ю: 'yu',
	я: 'ya',
}

export const slugify = (s: string) =>
	[...s.toLowerCase()]
		.map((c) => translit[c] ?? c)
		.join('')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '') || 'tag'

export class TagMapper {
	private known = new Map<string, string>()
	private suggestions: Record<string, string> = {}
	/** Hashtags missing from the config met in this run, hashtag → slug */
	readonly unknown = new Map<string, string>()
	/** Slugs from the translator; only these are saved, so `--no-translate` doesn't pin a transliteration */
	private suggested = new Map<string, string>()

	constructor(
		tags: Tag[],
		private translator: Translator | undefined,
	) {
		for (const t of tags) {
			this.known.set(t.hashtag.toLowerCase(), t.slug)
			for (const alias of t.aliases ?? []) this.known.set(alias.toLowerCase(), t.slug)
		}
	}

	async load() {
		try {
			this.suggestions = JSON.parse(await fs.readFile(suggestionsFile, 'utf8'))
		} catch {
			this.suggestions = {}
		}
	}

	/** Maps hashtags to slugs in order, without duplicates */
	async map(raw: string[]): Promise<string[]> {
		const out: string[] = []
		for (const hashtag of raw) {
			const slug = this.known.get(hashtag) ?? (await this.suggest(hashtag))
			if (!out.includes(slug)) out.push(slug)
		}
		return out
	}

	private async suggest(hashtag: string): Promise<string> {
		let slug = this.unknown.get(hashtag) ?? this.suggestions[hashtag]
		if (!slug && this.translator) {
			try {
				slug = slugify(await this.translator.tagSlug(hashtag))
				this.suggested.set(hashtag, slug)
			} catch (err) {
				console.warn(`Could not get a slug for #${hashtag}: ${(err as Error).message}`)
			}
		}
		slug ??= slugify(hashtag)
		this.unknown.set(hashtag, slug)
		return slug
	}

	/** Saves suggestions for tags still missing from the config */
	async save() {
		const next = Object.fromEntries(
			Object.entries({ ...this.suggestions, ...Object.fromEntries(this.suggested) })
				.filter(([hashtag]) => !this.known.has(hashtag))
				.sort(([a], [b]) => a.localeCompare(b)),
		)
		const before = JSON.stringify(this.suggestions)
		if (JSON.stringify(next) === before) return
		if (Object.keys(next).length) await fs.writeFile(suggestionsFile, JSON.stringify(next, null, '\t') + '\n')
		else await fs.rm(suggestionsFile, { force: true })
	}
}
