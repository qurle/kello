// Posts settle as scrolling brings them in: each post below the fold waits at a slight tilt
// (--settle-angle, post.sass) and straightens once, when it enters from the bottom while the page
// is scrolling, or when scrolling stops with it peeking in. Anything else that brings a post into
// view (load, scroll restoration, a filter, a resize, a font swap, a jump from above) straightens it
// at once, so nothing moves on its own.

export {};

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const posts = [...document.querySelectorAll<HTMLElement>('[data-post]')];

/** Small integer hash (murmur3's finaliser), the same one feed.js scatters with. */
const hash = (n: number) => {
	let h = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
	h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
	return (h ^ (h >>> 16)) >>> 0;
};

// A scroll within this long before a post comes into view counts as the reason it did.
const scrollWindow = 200;
let lastScroll = -Infinity;
// Until the page has loaded and restored its scroll position, nothing settles with motion.
let ready = false;

const settle = (post: HTMLElement, animate: boolean) => {
	observer.unobserve(post);
	if (animate) {
		post.toggleAttribute('data-settling', true);
		// Children's transitions bubble up too; dropping the transition early would cut the settle short.
		const done = (event: TransitionEvent) => {
			if (event.target !== post || event.propertyName !== 'rotate') return;
			post.removeAttribute('data-settling');
			post.removeEventListener('transitionend', done);
		};
		post.addEventListener('transitionend', done);
	}
	post.removeAttribute('data-settle');
};

const observer = new IntersectionObserver(
	(entries) => {
		const scrolling = ready && performance.now() - lastScroll < scrollWindow;
		for (const { target, isIntersecting, boundingClientRect } of entries) {
			if (!isIntersecting) continue;
			// Entering from below: its top edge is still inside the viewport.
			settle(target as HTMLElement, scrolling && boundingClientRect.top > 0 && !reducedMotion.matches);
		}
	},
	// A little up from the bottom edge, so the motion happens where it can be seen.
	{ rootMargin: '0px 0px -15% 0px' },
);

if (!reducedMotion.matches) {
	// Read every position first, then write: one layout for the whole feed. Posts a filter hides wait
	// too; whichever are in view when the filter shows them straighten at once.
	const below = posts.filter((post) => post.hidden || post.getBoundingClientRect().top >= innerHeight);
	for (const post of below) {
		post.dataset.settle = hash(Number(post.dataset.post)) & 1 ? 'cw' : 'ccw';
		observer.observe(post);
	}

	// Scrolling can stop with a post short of the observer's line, peeking in at the bottom. It settles
	// once the page comes to rest, so nothing stays tilted in view.
	const restDelay = 150;
	const peeking = () =>
		posts.filter((post) => {
			if (post.hidden || !post.dataset.settle) return false;
			const { top } = post.getBoundingClientRect();
			return top > 0 && top < innerHeight;
		});
	let rest: ReturnType<typeof setTimeout>;
	const settlePeeking = () => {
		if (!ready) return;
		for (const post of peeking()) settle(post, true);
	};
	addEventListener(
		'scroll',
		() => {
			lastScroll = performance.now();
			clearTimeout(rest);
			rest = setTimeout(settlePeeking, restDelay);
		},
		{ passive: true },
	);
	// A filter can bring waiting posts into view. Straighten them before the next paint rather than
	// in the observer, whose callback comes a frame late. feed.js has placed the posts by now.
	document.addEventListener('kello:filter', () => {
		const shown = posts.filter((post) => {
			if (post.hidden || !post.dataset.settle) return false;
			const { top, bottom } = post.getBoundingClientRect();
			return top < innerHeight && bottom > 0;
		});
		for (const post of shown) settle(post, false);
	});
	// Whatever is in view by then, after scroll restoration, was in view on load.
	const start = () =>
		setTimeout(() => {
			for (const post of peeking()) settle(post, false);
			ready = true;
		});
	if (document.readyState === 'complete') start();
	else addEventListener('load', start, { once: true });
}

// Turning reduced motion on mid-visit straightens everything that is still waiting.
reducedMotion.addEventListener('change', () => {
	if (reducedMotion.matches) for (const post of posts) if (post.dataset.settle) settle(post, false);
});
