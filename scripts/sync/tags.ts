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
	/** Hashtags missing from the config met in this run, RU → EN slug */
	readonly unknown = new Map<string, string>()
	/** Slugs from the translator; only these are saved, so `--no-translate` doesn't pin a transliteration */
	private suggested = new Map<string, string>()

	constructor(
		tags: Tag[],
		private translator: Translator | undefined,
	) {
		for (const t of tags) {
			this.known.set(t.ru.toLowerCase(), t.en)
			for (const alias of t.aliases ?? []) this.known.set(alias.toLowerCase(), t.en)
		}
	}

	async load() {
		try {
			this.suggestions = JSON.parse(await fs.readFile(suggestionsFile, 'utf8'))
		} catch {
			this.suggestions = {}
		}
	}

	/** Maps RU hashtags to EN slugs in order, without duplicates */
	async map(raw: string[]): Promise<string[]> {
		const out: string[] = []
		for (const ru of raw) {
			const en = this.known.get(ru) ?? (await this.suggest(ru))
			if (!out.includes(en)) out.push(en)
		}
		return out
	}

	private async suggest(ru: string): Promise<string> {
		let en = this.unknown.get(ru) ?? this.suggestions[ru]
		if (!en && this.translator) {
			try {
				en = slugify(await this.translator.tagSlug(ru))
				this.suggested.set(ru, en)
			} catch (err) {
				console.warn(`Could not get a slug for #${ru}: ${(err as Error).message}`)
			}
		}
		en ??= slugify(ru)
		this.unknown.set(ru, en)
		return en
	}

	/** Saves suggestions for tags still missing from the config */
	async save() {
		const next = Object.fromEntries(
			Object.entries({ ...this.suggestions, ...Object.fromEntries(this.suggested) })
				.filter(([ru]) => !this.known.has(ru))
				.sort(([a], [b]) => a.localeCompare(b)),
		)
		const before = JSON.stringify(this.suggestions)
		if (JSON.stringify(next) === before) return
		if (Object.keys(next).length) await fs.writeFile(suggestionsFile, JSON.stringify(next, null, '\t') + '\n')
		else await fs.rm(suggestionsFile, { force: true })
	}
}
