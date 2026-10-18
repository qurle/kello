// The feed in pages of `site.pageSize` posts: `/`, `/page/2/`… and `/ru`, `/ru/page/2/`…
import config from '../../kello.config';
import { strings, type Lang } from './i18n';
import type { Post } from './posts';

export const pageCount = (posts: Post[]) => Math.max(1, Math.ceil(posts.length / config.site.pageSize));

export const pagePosts = (posts: Post[], page: number) =>
	posts.slice((page - 1) * config.site.pageSize, page * config.site.pageSize);

/** Path of a page; the first is the language's home. */
export function pagePath(lang: Lang, page: number) {
	const home = strings[lang].path;
	return page === 1 ? home : `${home.replace(/\/$/, '')}/page/${page}/`;
}

/** Static paths for pages 2 and on. */
export const laterPages = (posts: Post[]) =>
	Array.from({ length: pageCount(posts) - 1 }, (_, i) => ({ params: { page: String(i + 2) } }));
