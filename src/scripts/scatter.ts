// Scattered feed on wide screens. Posts are narrow columns placed on a grid: a hash of the post id
// picks the starting column, and each post drops as high as the posts already in those columns allow,
// plus a hashed vertical jitter, so posts in different columns share vertical space. A post never sits
// above the one before it, so the feed still reads top to bottom. Without this script, and below the
// breakpoint, the feed stays a single column.

export {};

const feed = document.querySelector<HTMLElement>('[data-feed]')!;
const posts = [...feed.querySelectorAll<HTMLElement>('[data-post]')];
const wide = matchMedia('(min-width: 64rem)');

/** Small integer hash (murmur3's finaliser); spreads consecutive ids apart. */
function hash(n: number) {
	let h = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
	h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
	return (h ^ (h >>> 16)) >>> 0;
}

/** A custom property's value in px, whatever unit the token uses. */
function length(name: string) {
	const probe = document.createElement('div');
	probe.style.cssText = `position:absolute;visibility:hidden;width:var(${name})`;
	feed.append(probe);
	const px = probe.offsetWidth;
	probe.remove();
	return px;
}

const number = (name: string) => Number(getComputedStyle(feed).getPropertyValue(name)) || 0;

function reset() {
	feed.removeAttribute('data-scatter');
	feed.style.height = '';
	for (const post of posts) post.style.removeProperty('inset');
	for (const post of posts) post.style.removeProperty('width');
}

function layout() {
	if (!wide.matches) return reset();

	const columns = number('--scatter-columns');
	const span = number('--scatter-span');
	const gap = length('--scatter-gap');
	const rowGap = length('--scatter-row-gap');
	const jitter = length('--scatter-jitter');
	const column = (feed.clientWidth - (columns - 1) * gap) / columns;
	const width = span * column + (span - 1) * gap;
	const visible = posts.filter((post) => !post.hidden);

	feed.setAttribute('data-scatter', '');
	// Write every width first, then read every height: two layouts instead of one per post.
	for (const post of visible) post.style.width = `${width}px`;
	const heights = visible.map((post) => post.offsetHeight);

	const skyline = new Array<number>(columns).fill(0);
	let previousTop = 0;
	let previousStart = -1;

	visible.forEach((post, index) => {
		const h = hash(Number(post.dataset.post));
		// Where the post could go at each starting column, never above the previous post.
		const options = Array.from({ length: columns - span + 1 }, (_, start) => ({
			start,
			top: Math.max(...skyline.slice(start, start + span), previousTop),
		})).filter(({ start }) => start !== previousStart);
		// Of the columns that let it sit near the highest spot, the hash picks one.
		const highest = Math.min(...options.map((option) => option.top));
		const near = options.filter((option) => option.top <= highest + jitter);
		const { start, top: floor } = near[h % near.length];

		const top = floor + (index === 0 ? 0 : ((h >>> 16) % 1000) / 1000) * jitter;
		post.style.inset = `${top}px auto auto ${start * (column + gap)}px`;

		for (let c = start; c < start + span; c++) skyline[c] = top + heights[index] + rowGap;
		previousTop = top;
		previousStart = start;
	});

	feed.style.height = `${Math.max(0, ...skyline) - rowGap}px`;
}

// A full layout is two reflows for the whole feed, cheap enough to run straight away.
wide.addEventListener('change', layout);
document.addEventListener('kello:filter', layout);
document.fonts.ready.then(layout);
// Only the feed's width matters; its height is ours.
let lastWidth = 0;
new ResizeObserver(([entry]) => {
	if (entry.contentRect.width === lastWidth) return;
	lastWidth = entry.contentRect.width;
	layout();
}).observe(feed);
layout();
