// Media rows: chevrons, and videos that play only while in view. Posts from other pages
// (`kello:posts`) get the same.

export {};

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function setUpRow(row: HTMLElement) {
	const track = row.querySelector<HTMLElement>('[data-media-track]')!;
	const prev = row.querySelector<HTMLButtonElement>('[data-media-prev]');
	const next = row.querySelector<HTMLButtonElement>('[data-media-next]');
	if (!prev || !next) return;

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
