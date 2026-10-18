// File naming for images, shared by sync and the site. An image or poster `base` of width `width` is
// stored as `<base>-<w>.<format>` for each configured width below it, plus the first at or above it,
// which holds the original size. Nothing is upscaled

/** Configured widths stored for an image of this width, ascending */
export function storedWidths(width: number, widths: readonly number[]): number[] {
	const sorted = [...widths].sort((a, b) => a - b)
	const cap = sorted.findIndex((w) => w >= width)
	return cap === -1 ? sorted : sorted.slice(0, cap + 1)
}

export interface ImageSource {
	/** Path under the media folder, e.g. `338/1-800.webp` */
	file: string
	/** The file's real pixel width */
	width: number
	format: string
}

/** Every stored file of an image, smallest first, per format */
export function imageSources(
	base: string,
	width: number,
	media: { widths: readonly number[]; formats: readonly string[] },
): ImageSource[] {
	return storedWidths(width, media.widths).flatMap((w) =>
		media.formats.map((format) => ({ file: `${base}-${w}.${format}`, width: Math.min(w, width), format })),
	)
}
