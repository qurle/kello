// File naming for synced images, shared by scripts/sync and the site.
//
// An image (or video poster) `base` with original width `width` is stored as `<base>-<w>.<format>` for
// each configured width `w` below the original, plus the first configured width at or above it, which
// holds the original size. Nothing is upscaled and no two files are the same picture.
// The web preview serves photos at 800px at most, so most images have a single `-800` file today.

/** Configured widths that exist on disk for an image of this original width, ascending. */
export function storedWidths(width: number, widths: readonly number[]): number[] {
	const sorted = [...widths].sort((a, b) => a - b);
	const cap = sorted.findIndex((w) => w >= width);
	return cap === -1 ? sorted : sorted.slice(0, cap + 1);
}

export interface ImageSource {
	/** Path under `public/<media.dir>`, e.g. `338/1-800.webp`. */
	file: string;
	/** Real pixel width of that file, for `srcset` descriptors. */
	width: number;
	format: string;
	w: number;
}

/** Every stored file of an image, smallest first, for each format. */
export function imageSources(
	base: string,
	width: number,
	media: { widths: readonly number[]; formats: readonly string[] },
): ImageSource[] {
	return storedWidths(width, media.widths).flatMap((w) =>
		media.formats.map((format) => ({ file: `${base}-${w}.${format}`, width: Math.min(w, width), format, w })),
	);
}
