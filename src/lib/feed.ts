import { getPosts, type Post } from './posts';

export type { Post };

// Fixture posts for local development only. The content glob skips files starting with `_`.
const fixtures = import.meta.env.DEV
	? Object.values(import.meta.glob<Record<string, any>>('../data/posts/_fixture-*.json', { eager: true, import: 'default' }))
	: [];

/** All visible posts, newest first, plus the fixtures in dev. */
export async function getFeed(): Promise<Post[]> {
	const posts = await getPosts();
	if (!fixtures.length) return posts;
	const dev = fixtures.map((raw) => ({ ...raw, date: new Date(raw.date), media: raw.media ?? [] }) as Post);
	return [...posts, ...dev].sort((a, b) => b.date.getTime() - a.date.getTime());
}
