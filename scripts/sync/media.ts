import fs from 'node:fs/promises';
import path from 'node:path';
import sharp, { type Sharp } from 'sharp';
import { imageSources, storedWidths } from '../../src/lib/media';
import { firstFrame, hasFfmpeg, mp4Size } from './mp4';
import type { MediaEntry, ScrapedMedia, ScrapedPost } from './types';

export interface MediaOptions {
	/** Absolute path of `public/<media.dir>`. */
	root: string;
	widths: number[];
	formats: ('avif' | 'webp')[];
	/** WebP quality, 1–100. */
	quality: number;
	maxVideoMB: number;
}

type Warn = (msg: string) => void;

const encode = {
	avif: (img: Sharp, _quality: number) => img.avif({ quality: 55, effort: 4 }),
	webp: (img: Sharp, quality: number) => img.webp({ quality, smartSubsample: true }),
};

const exists = (file: string) =>
	fs.access(file).then(
		() => true,
		() => false,
	);

/** Writes through a temp file so an interrupted sync never leaves a half-written file that looks done. */
async function writeAtomic(file: string, data: Buffer) {
	await fs.mkdir(path.dirname(file), { recursive: true });
	const tmp = `${file}.tmp`;
	await fs.writeFile(tmp, data);
	await fs.rename(tmp, file);
}

class TooLarge extends Error {}

async function download(url: string, maxBytes = Infinity): Promise<Buffer> {
	for (let attempt = 1; ; attempt++) {
		try {
			const res = await fetch(url);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			if (Number(res.headers.get('content-length')) > maxBytes) {
				await res.body?.cancel();
				throw new TooLarge();
			}
			const chunks: Buffer[] = [];
			let size = 0;
			for await (const chunk of res.body as AsyncIterable<Uint8Array>) {
				size += chunk.byteLength;
				if (size > maxBytes) throw new TooLarge();
				chunks.push(Buffer.from(chunk));
			}
			return Buffer.concat(chunks);
		} catch (err) {
			if (err instanceof TooLarge || attempt >= 3) throw err;
			await new Promise((r) => setTimeout(r, 1500 * attempt));
		}
	}
}

async function sizeOf(source: Buffer) {
	const meta = await sharp(source).metadata();
	const rotated = (meta.orientation ?? 1) >= 5;
	return { width: (rotated ? meta.height : meta.width)!, height: (rotated ? meta.width : meta.height)! };
}

/**
 * Writes `<base>-<w>.<format>` for the widths `storedWidths(namedWidth)` picks, each resized to at most
 * the source width. `namedWidth` is the image's own width, or the video's for a poster.
 */
async function writeImage(source: Buffer, base: string, namedWidth: number, opts: MediaOptions) {
	const { width } = await sizeOf(source);
	for (const w of storedWidths(namedWidth, opts.widths)) {
		const resized = sharp(source).rotate().resize({ width: Math.min(w, width), withoutEnlargement: true });
		for (const format of opts.formats) {
			await writeAtomic(path.join(opts.root, `${base}-${w}.${format}`), await encode[format](resized.clone(), opts.quality).toBuffer());
		}
	}
}

/** Files under `public/<media.dir>` that an entry needs. */
export function filesOf(entry: MediaEntry, opts: MediaOptions): string[] {
	const images = (base: string, width: number) => imageSources(base, width, opts).map((s) => s.file);
	if (entry.type === 'image') return images(entry.file, entry.width);
	const poster = entry.poster && entry.width ? images(entry.poster, entry.width) : [];
	return entry.type === 'video' ? [entry.file, ...poster] : poster;
}

async function allExist(files: string[], opts: MediaOptions) {
	for (const f of files) if (!(await exists(path.join(opts.root, f)))) return false;
	return true;
}

const sameItem = (prev: MediaEntry | undefined, item: ScrapedMedia) =>
	prev?.messageId === item.messageId &&
	(item.type === 'image' ? prev.type === 'image' : prev.type === 'video' || prev.type === 'unavailable');

/** A poster made from Telegram's small thumbnail before ffmpeg was around: worth redoing from the video. */
async function hasThumbPoster(entry: MediaEntry & { type: 'video' }, opts: MediaOptions) {
	if (!entry.poster || !hasFfmpeg()) return false;
	const first = imageSources(entry.poster, entry.width, opts)[0];
	const { width = 0 } = await sharp(path.join(opts.root, first.file)).metadata();
	return width < first.width * 0.9;
}

async function syncVideo(post: ScrapedPost, item: ScrapedMedia & { type: 'video' }, n: number, opts: MediaOptions, warn: Warn): Promise<MediaEntry> {
	const base = `${post.telegramId}/${n}`;
	const thumb = item.poster ? await download(item.poster).catch(() => undefined) : undefined;
	const thumbSize = thumb && (await sizeOf(thumb));

	if (item.url) {
		try {
			const video = await download(item.url, opts.maxVideoMB * 1024 * 1024);
			const file = path.join(opts.root, `${base}.mp4`);
			await writeAtomic(file, video);
			const size = mp4Size(video) ?? (item.width && item.height ? { width: item.width, height: item.height } : thumbSize);
			if (!size) throw new Error('unknown video size');
			const frame = hasFfmpeg() ? await firstFrame(file).catch((err) => void warn(`post ${post.telegramId}: ${err.message}`)) : undefined;
			const poster = frame ?? thumb;
			if (poster) await writeImage(poster, `${base}-poster`, size.width, opts);
			return { type: 'video', messageId: item.messageId, file: `${base}.mp4`, poster: poster && `${base}-poster`, ...size };
		} catch (err) {
			if (!(err instanceof TooLarge)) throw err;
			warn(`post ${post.telegramId}: video ${n} is over ${opts.maxVideoMB} MB, linked to Telegram instead`);
		}
	}

	const width = item.width ?? thumbSize?.width;
	const height = item.height ?? thumbSize?.height;
	if (thumb && width) await writeImage(thumb, `${base}-poster`, width, opts);
	return { type: 'unavailable', messageId: item.messageId, poster: thumb && width ? `${base}-poster` : undefined, width, height };
}

async function syncItem(
	post: ScrapedPost,
	item: ScrapedMedia,
	n: number,
	prev: MediaEntry | undefined,
	opts: MediaOptions,
	warn: Warn,
): Promise<MediaEntry> {
	// Files already on disk for the same album item: nothing to download.
	if (prev && sameItem(prev, item) && (await allExist(filesOf(prev, opts), opts))) {
		if (prev.type === 'video' && (await hasThumbPoster(prev, opts))) {
			const frame = await firstFrame(path.join(opts.root, prev.file));
			await writeImage(frame, `${post.telegramId}/${n}-poster`, prev.width, opts);
			return { ...prev, poster: `${post.telegramId}/${n}-poster` };
		}
		// An unavailable video whose source has appeared, or now fits under the limit, is tried again.
		if (!(prev.type === 'unavailable' && item.type === 'video' && item.url)) return prev;
		const length = await fetch(item.url, { method: 'HEAD' })
			.then((r) => Number(r.headers.get('content-length')))
			.catch(() => 0);
		if (!length || length > opts.maxVideoMB * 1024 * 1024) return prev;
	}

	if (item.type === 'video') return syncVideo(post, item, n, opts, warn);
	const base = `${post.telegramId}/${n}`;
	const source = await download(item.url);
	const size = await sizeOf(source);
	await writeImage(source, base, size.width, opts);
	return { type: 'image', messageId: item.messageId, file: base, ...size };
}

/** Downloads a post's media in album order, reusing files from the previous sync, and removes stale files. */
export async function syncMedia(post: ScrapedPost, previous: MediaEntry[] | undefined, opts: MediaOptions, warn: Warn): Promise<MediaEntry[]> {
	const entries: MediaEntry[] = [];
	for (const [i, item] of post.media.entries()) {
		entries.push(await syncItem(post, item, i + 1, previous?.[i], opts, warn));
	}
	await removeStale(post.telegramId, entries, opts);
	return entries;
}

async function removeStale(telegramId: number, entries: MediaEntry[], opts: MediaOptions) {
	const dir = path.join(opts.root, String(telegramId));
	const keep = new Set(entries.flatMap((e) => filesOf(e, opts)).map((f) => path.basename(f)));
	const present = await fs.readdir(dir).catch(() => [] as string[]);
	for (const file of present) if (!keep.has(file)) await fs.rm(path.join(dir, file), { recursive: true, force: true });
	if (!keep.size) await fs.rm(dir, { recursive: true, force: true });
}

export const removeMedia = (telegramId: number, opts: MediaOptions) =>
	fs.rm(path.join(opts.root, String(telegramId)), { recursive: true, force: true });
