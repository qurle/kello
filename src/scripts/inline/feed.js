// Inlined right after the feed (Home.astro), so it runs while the page is still parsing, before the
// feed paints. Plain JS for that reason: Astro bundles <script> tags as deferred modules.
//
// 1. Media loading: marks image slots that are still loading so they show the dithered mosaic
//    (media.sass); images already in the cache are marked done before the first paint.
// 2. Scattered feed on wide screens. Posts are narrow columns on a grid: a hash of the post id picks
//    the start column among those that let the post sit near the highest free spot, then drops it by
//    a further hashed amount, so posts share vertical space without touching. A post never sits
//    above the one before it, so the feed still reads top to bottom. Below the breakpoint, or if this
//    fails, the feed stays a single column.
(() => {
	const root = document.documentElement;
	const feed = document.querySelector('[data-feed]');
	if (!feed) return;

	// 1. Media loading
	for (const img of feed.querySelectorAll('[data-loading] img')) {
		const slot = img.closest('[data-loading]');
		const done = () => slot.removeAttribute('data-loading');
		if (img.complete) done();
		else {
			img.addEventListener('load', done, { once: true });
			img.addEventListener('error', done, { once: true });
		}
	}

	// 2. Scatter
	const posts = [...feed.querySelectorAll('[data-post]')];
	const wide = matchMedia('(min-width: 64rem)');

	/** Small integer hash (murmur3's finaliser); spreads consecutive ids apart. */
	const hash = (n) => {
		let h = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
		h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
		return (h ^ (h >>> 16)) >>> 0;
	};

	/** A custom property's value in px, whatever unit the token uses. */
	const length = (name) => {
		const probe = document.createElement('div');
		probe.style.cssText = `position:absolute;visibility:hidden;width:var(${name})`;
		feed.append(probe);
		const px = probe.offsetWidth;
		probe.remove();
		return px;
	};

	const number = (name) => Number(getComputedStyle(feed).getPropertyValue(name)) || 0;

	const reset = () => {
		feed.removeAttribute('data-scatter');
		feed.style.height = '';
		for (const post of posts) {
			post.style.removeProperty('inset');
			post.style.removeProperty('width');
		}
	};

	const layout = () => {
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

		const skyline = new Array(columns).fill(0);
		let previousTop = 0;
		let previousStart = -1;

		visible.forEach((post, index) => {
			const h = hash(Number(post.dataset.post));
			// Where the post could go at each start column, never above the previous post.
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
	};

	const safe = () => {
		try {
			layout();
		} catch (err) {
			// Show the single column rather than a hidden feed.
			delete root.dataset.js;
			reset();
			throw err;
		}
	};

	// A full layout is two reflows for the whole feed, cheap enough to run straight away.
	wide.addEventListener('change', safe);
	document.addEventListener('kello:filter', safe);
	document.fonts.ready.then(safe);
	// Only the feed's width matters; its height is ours.
	let lastWidth = feed.clientWidth;
	new ResizeObserver(([entry]) => {
		if (entry.contentRect.width === lastWidth) return;
		lastWidth = entry.contentRect.width;
		safe();
	}).observe(feed);
	safe();
})();
