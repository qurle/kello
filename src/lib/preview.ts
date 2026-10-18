// Build-time previews for the loading state: images shrunk to 16px and inlined as WebP data URLs (MediaRow.astro dithers them).
import path from 'node:path';
import sharp from 'sharp';
import config from '../../kello.config';
import { imageSources } from './media';

const previewWidth = 16;
const cache = new Map<string, Promise<string | undefined>>();

/** Data URL of an image's preview, or undefined if its file is missing. */
export function preview(file: string | undefined, width: number | undefined) {
	if (!file || !width) return Promise.resolve(undefined);
	const key = `${file}@${width}`;
	if (!cache.has(key)) {
		const source = imageSources(file, width, config.media)[0];
		const absolute = path.resolve('public', config.media.dir, source.file);
		cache.set(
			key,
			sharp(absolute)
				.resize({ width: previewWidth })
				.webp({ quality: 50 })
				.toBuffer()
				.then((webp) => `data:image/webp;base64,${webp.toString('base64')}`)
				.catch(() => undefined),
		);
	}
	return cache.get(key)!;
}
