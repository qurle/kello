// Tiny previews for the media loading state, made at build time from the synced files: each image is
// shrunk to `previewWidth` pixels across and inlined as a WebP data URL (about 100 bytes). The page
// scales it up smoothly and dithers it into dots (media.sass) until the image arrives.
import path from 'node:path';
import sharp from 'sharp';
import config from '../../kello.config';
import { imageSources } from './media';

const previewWidth = 16;
const cache = new Map<string, Promise<string | undefined>>();

/** Data URL of a mosaic preview for a synced image or poster, or undefined if its file is missing. */
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
