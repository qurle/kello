import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>['data'];

// Fixture posts for local development only. The content glob skips files starting with `_`.
const fixtures = import.meta.env.DEV
	? Object.values(import.meta.glob<Record<string, any>>('../data/posts/_fixture-*.json', { eager: true, import: 'default' }))
	: [];

/** All posts, newest first. */
export async function getFeed(): Promise<Post[]> {
	// TODO: switch to getPosts() from ./posts once sync lands, so overrides apply.
	const posts = (await getCollection('posts')).map((entry) => entry.data);
	const dev = fixtures.map((raw) => ({ ...raw, date: new Date(raw.date), media: raw.media ?? [] }) as Post);
	return [...posts, ...dev].sort((a, b) => b.date.getTime() - a.date.getTime() || b.telegramId - a.telegramId);
}
