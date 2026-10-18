// Posts below the fold wait at a slight tilt and straighten once, as scrolling brings them in.
// Any other way into view (load, restored scroll, filter, resize) straightens them without motion.

export {};

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const posts = [...document.querySelectorAll<HTMLElement>('[data-post]')];

/** A scroll this recently before a post enters view counts as the reason it did. */
const scrollWindow = 200;
let lastScroll = -Infinity;
/** Set once the page has loaded and restored its scroll position. */
let ready = false;

const settle = (post: HTMLElement, animate: boolean) => {
	observer.unobserve(post);
	if (animate) {
		post.toggleAttribute('data-settling', true);
		// Transitions of children bubble up: only the post's own rotate ends the settle.
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
			// Entering from below: its top edge is still in view.
			settle(target as HTMLElement, scrolling && boundingClientRect.top > 0 && !reducedMotion.matches);
		}
	},
	// Fires above the bottom edge, where the motion can be seen.
	{ rootMargin: '0px 0px -15% 0px' },
);

if (!reducedMotion.matches) {
	// Reads before writes: one layout. Posts hidden by a filter wait too.
	const below = posts.filter((post) => post.hidden || post.getBoundingClientRect().top >= innerHeight);
	for (const post of below) {
		post.dataset.settle = Number(post.dataset.hash) & 1 ? 'cw' : 'ccw';
		observer.observe(post);
	}

	// A post peeking in short of the observer's line settles when scrolling stops.
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
	// The observer would answer a frame late, so a filter straightens shown posts directly.
	document.addEventListener('kello:filter', () => {
		const shown = posts.filter((post) => {
			if (post.hidden || !post.dataset.settle) return false;
			const { top, bottom } = post.getBoundingClientRect();
			return top < innerHeight && bottom > 0;
		});
		for (const post of shown) settle(post, false);
	});
	// What is in view after scroll restoration was in view on load.
	const start = () =>
		setTimeout(() => {
			for (const post of peeking()) settle(post, false);
			ready = true;
		});
	if (document.readyState === 'complete') start();
	else addEventListener('load', start, { once: true });
}

reducedMotion.addEventListener('change', () => {
	if (reducedMotion.matches) for (const post of posts) if (post.dataset.settle) settle(post, false);
});
