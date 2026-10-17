import config from '../../kello.config';
import type { Lang } from './i18n';

const order = new Map(config.tags.map((tag, index) => [tag.en, index]));
const bySlug = new Map(config.tags.map((tag) => [tag.en, tag]));

/** Label of a tag slug: the config label on `/`, the hashtag on `/ru`. Unknown slugs show as is. */
export function tagLabel(slug: string, lang: Lang) {
	const tag = bySlug.get(slug);
	if (!tag) return slug;
	return lang === 'ru' ? tag.ru : (tag.label ?? tag.en);
}

/** Sorts slugs into filter-line order; slugs missing from the config go last. */
export function sortTags(slugs: string[]) {
	return [...slugs].sort((a, b) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity));
}

/** Filter-line tags in config order, without hidden ones and without tags no post uses. */
export function filterTags(used: Set<string>) {
	return config.tags.filter((tag) => !tag.hidden && used.has(tag.en)).map((tag) => tag.en);
}
