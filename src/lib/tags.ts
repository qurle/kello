import config from '../../kello.config';
import type { Lang } from './i18n';

const order = new Map(config.tags.map((tag, index) => [tag.en, index]));
const bySlug = new Map(config.tags.map((tag) => [tag.en, tag]));

/** The config label on `/`, the hashtag on `/ru`; unknown slugs show as is. */
export function tagLabel(slug: string, lang: Lang) {
	const tag = bySlug.get(slug);
	if (!tag) return slug;
	return lang === 'ru' ? tag.ru : (tag.label ?? tag.en);
}

/** Sorts slugs into config order; unknown ones go last. */
export function sortTags(slugs: string[]) {
	return [...slugs].sort((a, b) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity));
}

/** Filter-line tags: in config order, not hidden, used by a post. */
export function filterTags(used: Set<string>) {
	return config.tags.filter((tag) => !tag.hidden && used.has(tag.en)).map((tag) => tag.en);
}
