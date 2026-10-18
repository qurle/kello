// Media rows: chevrons, items past the first two, and videos that play only while in view. Posts from
// other pages (`kello:posts`) get the same.

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

/** Puts in the pictures a row holds back in <noscript> (MediaRow.astro). They stay lazy. */
export function reveal(scope: ParentNode) {
	for (const later of scope.querySelectorAll('noscript[data-later]')) {
		const template = document.createElement('template');
		template.innerHTML = later.textContent ?? '';
		// The dither stays until the picture arrives, as feed.js does for the rest.
		const slot = later.closest('[data-loading]');
		const img = template.content.querySelector('img');
		if (slot && img) {
			const done = () => slot.removeAttribute('data-loading');
			img.addEventListener('load', done, { once: true });
			img.addEventListener('error', done, { once: true });
		}
		later.replaceWith(template.content);
	}
}

function setUpRow(row: HTMLElement) {
	const track = row.querySelector<HTMLElement>('[data-media-track]')!;
	const prev = row.querySelector<HTMLButtonElement>('[data-media-prev]');
	const next = row.querySelector<HTMLButtonElement>('[data-media-next]');
	if (!prev || !next) return;

	// The rest of the row loads once it's scrolled, or the mouse reaches the next chevron.
	const revealRow = () => reveal(row);
	track.addEventListener('scroll', revealRow, { once: true, passive: true });
	next.addEventListener('pointerenter', revealRow, { once: true });

	const update = () => {
		const end = track.scrollWidth - track.clientWidth;
		prev.toggleAttribute('data-off', track.scrollLeft <= 1);
		next.toggleAttribute('data-off', track.scrollLeft >= end - 1);
	};

	const step = (direction: number) => {
		const slot = track.firstElementChild as HTMLElement;
		const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
		track.scrollBy({ left: direction * (slot.offsetWidth + gap), behavior: reducedMotion.matches ? 'auto' : 'smooth' });
	};

	prev.addEventListener('click', () => step(-1));
	next.addEventListener('click', () => step(1));
	track.addEventListener('scroll', update, { passive: true });
	new ResizeObserver(update).observe(track);
}


const observer = new IntersectionObserver(
	(entries) => {
		for (const { target, isIntersecting } of entries) {
			const video = target as HTMLVideoElement;
			if (isIntersecting && !reducedMotion.matches) video.play().catch(() => {});
			else video.pause();
		}
	},
	{ threshold: 0.5 },
);

const videos: HTMLVideoElement[] = [];

function setUp(scope: ParentNode) {
	scope.querySelectorAll<HTMLElement>('[data-media-row]').forEach(setUpRow);
	for (const video of scope.querySelectorAll<HTMLVideoElement>('video[data-autoplay]')) {
		videos.push(video);
		observer.observe(video);
	}
}

// Observing again reports every video's state, which plays or pauses it under the new setting.
reducedMotion.addEventListener('change', () => {
	observer.disconnect();
	videos.forEach((video) => observer.observe(video));
});
document.addEventListener('kello:posts', (event) => {
	for (const post of (event as CustomEvent<HTMLElement[]>).detail) setUp(post);
});
setUp(document);
