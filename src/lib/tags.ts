import config from '../../kello.config'
import { original, type Lang } from './i18n'

const order = new Map(config.tags.map((tag, index) => [tag.slug, index]))
const bySlug = new Map(config.tags.map((tag) => [tag.slug, tag]))

/** The hashtag in the channel's language, the label (or slug) in the translation; unknown slugs show as is */
export function tagLabel(slug: string, lang: Lang) {
	const tag = bySlug.get(slug)
	if (!tag) return slug
	return lang === original ? tag.hashtag : (tag.label ?? tag.slug)
}

/** Sorts slugs into config order; unknown ones go last */
export function sortTags(slugs: string[]) {
	return [...slugs].sort((a, b) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity))
}

/** Filter-line tags: in config order, not hidden, used by a post */
export function filterTags(used: Set<string>) {
	return config.tags.filter((tag) => !tag.hidden && used.has(tag.slug)).map((tag) => tag.slug)
}
