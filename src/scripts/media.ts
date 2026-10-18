// Media rows: chevrons for a mouse, and videos that play only while in view.

export {};

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

for (const row of document.querySelectorAll<HTMLElement>('[data-media-row]')) {
	const track = row.querySelector<HTMLElement>('[data-media-track]')!;
	const prev = row.querySelector<HTMLButtonElement>('[data-media-prev]');
	const next = row.querySelector<HTMLButtonElement>('[data-media-next]');
	if (!prev || !next) continue;

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

const videos = [...document.querySelectorAll<HTMLVideoElement>('video[data-autoplay]')];

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

const observe = () => {
	observer.disconnect();
	videos.forEach((video) => observer.observe(video));
};

reducedMotion.addEventListener('change', observe);
observe();
