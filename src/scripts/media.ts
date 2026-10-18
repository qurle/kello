import { draggable } from './drag'

// Media rows: chevrons, mouse drag, pictures that load as they near the window, and videos that play only while in
// view. Posts from other pages (`kello:posts`) get the same

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

/**
 * Puts in the pictures held back in <noscript> (MediaRow.astro). With a priority they load now at that
 * priority; without, they stay lazy
 */
export function reveal(scope: ParentNode, priority?: 'high' | 'low') {
	for (const later of scope.querySelectorAll('noscript[data-later]')) {
		const template = document.createElement('template')
		template.innerHTML = later.textContent ?? ''
		if (priority) {
			template.content.querySelectorAll('img').forEach((img) => {
				img.loading = 'eager'
				img.setAttribute('fetchpriority', priority)
			})
		}
		// The dither stays until the picture arrives, as feed.js does for the rest
		const slot = later.closest('[data-loading]')
		const img = template.content.querySelector('img')
		if (slot && img) {
			const done = () => slot.removeAttribute('data-loading')
			img.addEventListener('load', done, { once: true })
			img.addEventListener('error', done, { once: true })
		}
		later.replaceWith(template.content)
	}
}

function setUpRow(row: HTMLElement) {
	const track = row.querySelector<HTMLElement>('[data-media-track]')!
	const prev = row.querySelector<HTMLButtonElement>('[data-media-prev]')
	const next = row.querySelector<HTMLButtonElement>('[data-media-next]')
	if (!prev || !next) return

	// The rest of the row loads once it's scrolled, a mouse presses it (a drag can coast several slides) or
	// reaches the next chevron. Until then only the slots showing in the row are revealed (`nearing` sees the
	// row's clipping)
	const revealRow = () => reveal(row)
	track.addEventListener('scroll', revealRow, { once: true, passive: true })
	track.addEventListener('pointerdown', revealRow, { once: true })
	next.addEventListener('pointerenter', revealRow, { once: true })

	const update = () => {
		const end = track.scrollWidth - track.clientWidth
		prev.toggleAttribute('data-off', track.scrollLeft <= 1)
		next.toggleAttribute('data-off', track.scrollLeft >= end - 1)
	}

	// Slots scroll to their start (MediaRow.astro); the track is their offset parent
	draggable(track, () => [...track.children].map((slot) => (slot as HTMLElement).offsetLeft))

	const step = (direction: number) => {
		const slot = track.firstElementChild as HTMLElement
		const gap = parseFloat(getComputedStyle(track).columnGap) || 0
		track.scrollBy({ left: direction * (slot.offsetWidth + gap), behavior: reducedMotion.matches ? 'auto' : 'smooth' })
	}

	prev.addEventListener('click', () => step(-1))
	next.addEventListener('click', () => step(1))
	track.addEventListener('scroll', update, { passive: true })
	new ResizeObserver(update).observe(track)
}

// Pictures go in within half a window of it, rather than the browser's lazy-loading distance of several
// windows, and those in view load first. While the page scrolls, a slot goes in only once it has stayed
// that near for `dwell` ms, so a fast scroll doesn't start downloads for slots it flies past, which would
// hold up the ones where it stops. At rest, the first load included, it goes in at once
const dwell = 120
let lastScroll = -Infinity
addEventListener('scroll', () => (lastScroll = performance.now()), { passive: true })
const waiting = new Map<Element, number>()

function settleIn(slot: Element) {
	waiting.delete(slot)
	nearing.unobserve(slot)
	const box = slot.getBoundingClientRect()
	reveal(slot, box.top < innerHeight && box.bottom > 0 ? 'high' : 'low')
}

const nearing = new IntersectionObserver(
	(entries) => {
		for (const { target, isIntersecting } of entries) {
			clearTimeout(waiting.get(target))
			waiting.delete(target)
			if (!isIntersecting) continue
			if (performance.now() - lastScroll > dwell) settleIn(target)
			else
				waiting.set(
					target,
					window.setTimeout(() => settleIn(target), dwell),
				)
		}
	},
	{ rootMargin: '50% 0px' },
)

// Videos wait for the load event, which waits for the pictures in view, so a long video doesn't take
// their bandwidth
const pageLoaded = new Promise<void>((resolve) =>
	document.readyState === 'complete' ? resolve() : addEventListener('load', () => resolve(), { once: true }),
)
const inView = new Set<HTMLVideoElement>()

const observer = new IntersectionObserver(
	(entries) => {
		for (const { target, isIntersecting } of entries) {
			const video = target as HTMLVideoElement
			if (isIntersecting) inView.add(video)
			else inView.delete(video)
			if (isIntersecting && !reducedMotion.matches) {
				pageLoaded.then(() => {
					if (inView.has(video)) video.play().catch(() => {})
				})
			} else video.pause()
		}
	},
	{ threshold: 0.5 },
)

function setUp(scope: ParentNode) {
	scope.querySelectorAll<HTMLElement>('[data-media-row]').forEach(setUpRow)
	for (const slot of scope.querySelectorAll('[data-slot]'))
		if (slot.querySelector('noscript[data-later]')) nearing.observe(slot)
	scope.querySelectorAll('video[data-autoplay]').forEach((video) => observer.observe(video))
}

// Observing again reports every video's state, which plays or pauses it under the new setting
reducedMotion.addEventListener('change', () => {
	observer.disconnect()
	document.querySelectorAll('video[data-autoplay]').forEach((video) => observer.observe(video))
})
document.addEventListener('kello:posts', (event) => {
	for (const post of (event as CustomEvent<HTMLElement[]>).detail) setUp(post)
})
setUp(document)
