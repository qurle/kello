import { getCollection, type CollectionEntry } from 'astro:content'
import { overrides as defaultOverrides, type Overrides } from '../data/overrides'
import { typeset } from './typography'

export type Post = CollectionEntry<'posts'>['data']

/** Applies overrides and drops hidden posts */
export function applyOverrides(posts: Post[], overrides: Overrides = defaultOverrides): Post[] {
	return posts.flatMap((post) => {
		const o = overrides[post.telegramId]
		if (!o) return [post]
		if (o.hidden) return []
		return [
			{
				...post,
				tags: o.tags ?? post.tags,
				text: post.text && o.text ? { ...post.text, ...o.text } : post.text,
			},
		]
	})
}

/** Visible posts with overrides and typography applied, newest first */
export async function getPosts(): Promise<Post[]> {
	const posts = (await getCollection('posts')).map((entry) => entry.data)
	return applyOverrides(posts)
		.map((post) =>
			post.text
				? { ...post, text: Object.fromEntries(Object.entries(post.text).map(([lang, html]) => [lang, typeset(html)])) }
				: post,
		)
		.sort((a, b) => b.date.getTime() - a.date.getTime())
}
