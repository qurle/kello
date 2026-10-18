import fs from 'node:fs/promises'
import path from 'node:path'
import type { PostFile } from './types'

export const postsDir = 'src/data/posts'

export async function readPosts(): Promise<Map<number, PostFile>> {
	const posts = new Map<number, PostFile>()
	const files = await fs.readdir(postsDir).catch(() => [] as string[])
	for (const file of files.filter((f) => /^\d+\.json$/.test(f))) {
		const post = JSON.parse(await fs.readFile(path.join(postsDir, file), 'utf8')) as PostFile
		posts.set(post.telegramId, post)
	}
	return posts
}

/** Fixed key order keeps diffs small */
export const serializePost = (p: PostFile) =>
	JSON.stringify(
		{
			telegramId: p.telegramId,
			date: p.date,
			tags: p.tags,
			text: p.text,
			sourceHash: p.sourceHash,
			link: p.link,
			media: p.media,
		},
		null,
		'\t',
	) + '\n'

/** Writes the post if it changed; returns whether it did */
export async function writePost(post: PostFile): Promise<boolean> {
	const file = path.join(postsDir, `${post.telegramId}.json`)
	const next = serializePost(post)
	if ((await fs.readFile(file, 'utf8').catch(() => '')) === next) return false
	await fs.mkdir(postsDir, { recursive: true })
	await fs.writeFile(file, next)
	return true
}

export const removePost = (telegramId: number) => fs.rm(path.join(postsDir, `${telegramId}.json`), { force: true })
