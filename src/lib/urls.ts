import config from '../../kello.config'
import { imageSources } from './media'

const base = `/${config.media.dir}/`
const fallbackFormat = config.media.formats.at(-1)!

/** URL of a file under the media folder */
export const mediaUrl = (file: string) => base + file

/** `srcset` per format from the files that exist; `src` is the smallest file in the last format */
export function imageSet(file: string, width = config.media.widths[0]) {
	const sources = imageSources(file, width, config.media)
	const srcset = (format: string) =>
		sources
			.filter((source) => source.format === format)
			.map((source) => `${mediaUrl(source.file)} ${source.width}w`)
			.join(', ')
	const formats = config.media.formats.map((format) => ({ format, srcset: srcset(format) }))
	const src = mediaUrl(sources.find((source) => source.format === fallbackFormat)!.file)
	return { formats, fallbackFormat, src }
}

/** Link to a post, or with `single` to one album item */
export const telegramUrl = (id: number, single = false) =>
	`https://t.me/${config.channel.username}/${id}${single ? '?single' : ''}`

/** `https://www.psiquantum.com/news` → `psiquantum.com` */
export const domain = (url: string) => new URL(url).hostname.replace(/^www\./, '')
