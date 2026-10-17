import config from '../../kello.config';

const base = `/${config.media.dir}/`;
const widths = [...config.media.widths].sort((a, b) => a - b);

/** URL of a file that already has its extension, such as a video. */
export const mediaUrl = (file: string) => base + file;

/** `srcset` for one format of a resized image (`338/1` → `338/1-960.avif 960w, …`). */
export const imageSrcset = (file: string, format: string) =>
	widths.map((width) => `${base}${file}-${width}.${format} ${width}w`).join(', ');

/** Fallback `src` for a resized image: the smallest width in the last configured format. */
export const imageSrc = (file: string) => `${base}${file}-${widths[0]}.${config.media.formats.at(-1)}`;

export const imageFormats = config.media.formats;

/** A poster is either a resized image (no extension) or a single file (`338/2.jpg`). */
export const isResized = (file: string) => !/\.[a-z0-9]+$/i.test(file);

/** URL of a poster, resized or not. */
export const posterUrl = (poster: string) => (isResized(poster) ? imageSrc(poster) : mediaUrl(poster));

/** Telegram post URL. */
export const telegramUrl = (id: number) => `https://t.me/${config.channel.username}/${id}`;

/** `https://www.psiquantum.com/news` → `psiquantum.com` */
export const domain = (url: string) => new URL(url).hostname.replace(/^www\./, '');
