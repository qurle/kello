// Horizontal position of each post on wide screens, as a fraction of the free space beside its column:
// 0 is flush left, 1 flush right. A hash of the post id picks one of the stops, so a post keeps its
// place between builds, and no post sits at the same stop as the one above it.

const stops = [0, 0.25, 0.5, 0.75, 1];

/** Small integer hash (a step of murmur3's finaliser); spreads consecutive ids apart. */
function hash(n: number) {
	let h = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
	h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
	return (h ^ (h >>> 16)) >>> 0;
}

/** Offsets for posts in feed order. */
export function offsets(ids: number[]): number[] {
	let previous = -1;
	return ids.map((id) => {
		const h = hash(id);
		let stop = h % stops.length;
		// Shift to another stop, also picked by the hash, when it repeats the post above.
		if (stop === previous) stop = (stop + 1 + ((h >>> 8) % (stops.length - 1))) % stops.length;
		previous = stop;
		return stops[stop];
	});
}
