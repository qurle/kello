import { getCollection, type CollectionEntry } from 'astro:content';
import { overrides as defaultOverrides, type Overrides } from '../data/overrides';

export type Post = CollectionEntry<'posts'>['data'];

/** Applies hand-written overrides to synced posts. Hidden posts are dropped. */
export function applyOverrides(posts: Post[], overrides: Overrides = defaultOverrides): Post[] {
	return posts.flatMap((post) => {
		const o = overrides[post.telegramId];
		if (!o) return [post];
		if (o.hidden) return [];
		return [
			{
				...post,
				tags: o.tags ?? post.tags,
				text: post.text && o.text?.en !== undefined ? { ...post.text, en: o.text.en } : post.text,
			},
		];
	});
}

/** All visible posts with overrides applied, newest first. */
export async function getPosts(): Promise<Post[]> {
	const posts = (await getCollection('posts')).map((entry) => entry.data);
	return applyOverrides(posts).sort((a, b) => b.date.getTime() - a.date.getTime());
}
