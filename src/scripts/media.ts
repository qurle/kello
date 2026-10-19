// Media rows: chevrons, mouse drag, pictures held back until they near the window, and videos that play
// only in view. Posts from other pages (`kello:posts`) get the same
import { draggable } from './drag'
import { reducedMotion, scrollBehavior } from './motion'

/** Ends a slot's or slide's loading state. Media that came before its dither showed (cached) appear at once */
export function loaded(holder: Element) {
	const dither = holder.querySelector(':scope > .dither')
	if (dither && getComputedStyle(dither).visibility === 'hidden') holder.setAttribute('data-quick', '')
	holder.removeAttribute('data-loading')
}

/** Calls `done` once the image has loaded and decoded, so it can paint at once, or failed */
export function onLoad(img: HTMLImageElement, done: () => void) {
	if (img.complete && img.naturalWidth) return done()
	img.addEventListener(
		'load',
		() =>
			img
				.decode()
				.catch(() => {})
				.then(done),
		{ once: true },
	)
	img.addEventListener('error', done, { once: true })
}

/** Puts in pictures held in <noscript> (Picture.astro): at `priority` now, or lazily without one */
export function reveal(scope: ParentNode, priority?: 'high' | 'low') {
	for (const later of scope.querySelectorAll('noscript[data-later]')) {
		const template = document.createElement('template')
		template.innerHTML = later.textContent ?? ''
		const img = template.content.querySelector('img')
		if (img) {
			if (priority) {
				img.loading = 'eager'
				img.fetchPriority = priority
			}
			const slot = later.closest('[data-loading]')
			if (slot) onLoad(img, () => loaded(slot))
		}
		later.replaceWith(template.content)
	}
}

function setUpRow(row: HTMLElement) {
	const track = row.querySelector<HTMLElement>('[data-media-track]')!
	const prev = row.querySelector<HTMLButtonElement>('[data-media-prev]')
	const next = row.querySelector<HTMLButtonElement>('[data-media-next]')
	if (!prev || !next) return

	// Slides out of the row's view wait for a sign it will move: a scroll, a press (a drag can coast
	// several slides) or the mouse on the next chevron
	const revealRow = () => reveal(row)
	track.addEventListener('scroll', revealRow, { once: true, passive: true })
	track.addEventListener('pointerdown', revealRow, { once: true })
	next.addEventListener('pointerenter', revealRow, { once: true })

	draggable(track, () => [...track.children].map((slot) => (slot as HTMLElement).offsetLeft))

	const step = (direction: number) => {
		const slot = track.firstElementChild as HTMLElement
		const gap = parseFloat(getComputedStyle(track).columnGap) || 0
		track.scrollBy({ left: direction * (slot.offsetWidth + gap), behavior: scrollBehavior() })
	}
	prev.addEventListener('click', () => step(-1))
	next.addEventListener('click', () => step(1))

	const update = () => {
		prev.toggleAttribute('data-off', track.scrollLeft <= 1)
		next.toggleAttribute('data-off', track.scrollLeft >= track.scrollWidth - track.clientWidth - 1)
	}
	track.addEventListener('scroll', update, { passive: true })
	new ResizeObserver(update).observe(track)
}

// A slot goes in within half a window, those in view first. While the page scrolls it must stay that near
// for `dwell` ms, so a fast scroll doesn't spend bandwidth on slots it flies past
const dwell = 120
let lastScroll = -Infinity
addEventListener('scroll', () => (lastScroll = performance.now()), { passive: true })
const waiting = new Map<Element, number>()

function settleIn(slot: Element) {
	waiting.delete(slot)
	nearing.unobserve(slot)
	const { top, bottom } = slot.getBoundingClientRect()
	reveal(slot, top < innerHeight && bottom > 0 ? 'high' : 'low')
}

const nearing = new IntersectionObserver(
	(entries) => {
		for (const { target, isIntersecting } of entries) {
			clearTimeout(waiting.get(target))
			waiting.delete(target)
			if (!isIntersecting) continue
			if (performance.now() - lastScroll > dwell) settleIn(target)
			else waiting.set(target, window.setTimeout(settleIn, dwell, target))
		}
	},
	{ rootMargin: '50% 0px' },
)

// Videos start after the load event, which waits for the pictures in view
const pageLoaded = new Promise((resolve) =>
	document.readyState === 'complete' ? resolve(null) : addEventListener('load', resolve, { once: true }),
)
const inView = new Set<HTMLVideoElement>()

const playing = new IntersectionObserver(
	(entries) => {
		for (const { target, isIntersecting } of entries) {
			const video = target as HTMLVideoElement
			if (isIntersecting) inView.add(video)
			else inView.delete(video)
			if (!isIntersecting || reducedMotion.matches) video.pause()
			else
				pageLoaded.then(() => {
					if (inView.has(video)) video.play().catch(() => {})
				})
		}
	},
	{ threshold: 0.5 },
)

function setUp(scope: ParentNode) {
	scope.querySelectorAll<HTMLElement>('[data-media-row]').forEach(setUpRow)
	for (const slot of scope.querySelectorAll('[data-slot]'))
		if (slot.querySelector('noscript[data-later]')) nearing.observe(slot)
	scope.querySelectorAll('video[data-autoplay]').forEach((video) => playing.observe(video))
}

// Observing again replays each video's state under the new setting
reducedMotion.addEventListener('change', () => {
	playing.disconnect()
	document.querySelectorAll('video[data-autoplay]').forEach((video) => playing.observe(video))
})
document.addEventListener('kello:posts', (event) => {
	for (const post of (event as CustomEvent<HTMLElement[]>).detail) setUp(post)
})
setUp(document)
