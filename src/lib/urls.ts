import config from '../../kello.config';
import { imageSources } from './media';

const base = `/${config.media.dir}/`;
const fallbackFormat = config.media.formats.at(-1)!;

/** URL of a file under `public/<media.dir>`, such as a video. */
export const mediaUrl = (file: string) => base + file;

/**
 * `srcset` per format for a synced image or poster, from the files that exist for its original width.
 * The fallback `src` is the smallest file in the last configured format.
 */
export function imageSet(file: string, width = config.media.widths[0]) {
	const sources = imageSources(file, width, config.media);
	const srcset = (format: string) =>
		sources
			.filter((source) => source.format === format)
			.map((source) => `${mediaUrl(source.file)} ${source.width}w`)
			.join(', ');
	const formats = config.media.formats.map((format) => ({ format, srcset: srcset(format) }));
	const src = mediaUrl(sources.find((source) => source.format === fallbackFormat)!.file);
	return { formats, fallbackFormat, src };
}

/** Telegram link to a post, or to one album item with `?single`. */
export const telegramUrl = (id: number, single = false) =>
	`https://t.me/${config.channel.username}/${id}${single ? '?single' : ''}`;

/** `https://www.psiquantum.com/news` → `psiquantum.com` */
export const domain = (url: string) => new URL(url).hostname.replace(/^www\./, '');
