// Mouse drag for the scroll-snapped carousels: feed media rows (media.ts) and the viewer (viewer.ts). The
// track follows the pointer with snapping off, then glides to a slide the way a swipe settles: the nearest
// one after a short drag, otherwise the next one in the drag's direction. Touch and pens keep the
// browser's own scrolling, and a press that doesn't move stays a click

/** Pixels a press moves before it becomes a drag */
const threshold = 6
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

/** `snaps` gives the scroll position of each slide, in order */
export function draggable(track: HTMLElement, snaps: () => number[]) {
	let start: { x: number; left: number } | null = null
	let dragging = false
	let swallowClick = false

	track.addEventListener('pointerdown', (event) => {
		if (event.pointerType !== 'mouse' || event.button !== 0) return
		// Native video controls keep their own drags (the viewer under reduced motion)
		if ((event.target as Element).closest('video[controls]')) return
		start = { x: event.clientX, left: track.scrollLeft }
	})

	track.addEventListener('pointermove', (event) => {
		if (!start) return
		const dx = event.clientX - start.x
		if (!dragging) {
			if (Math.abs(dx) < threshold) return
			dragging = true
			track.setPointerCapture(event.pointerId)
			track.dataset.dragging = ''
			track.style.scrollSnapType = 'none'
		}
		track.scrollLeft = start.left - dx
	})

	const release = () => {
		if (!start) return
		const moved = track.scrollLeft - start.left
		start = null
		if (!dragging) return
		dragging = false
		delete track.dataset.dragging
		// The click that ends a drag isn't one
		swallowClick = true
		setTimeout(() => (swallowClick = false))
		glide(moved)
	}

	const glide = (moved: number) => {
		const here = track.scrollLeft
		const max = track.scrollWidth - track.clientWidth
		const points = snaps().map((left) => Math.min(Math.max(left, 0), max))
		const nearest = points.reduce((best, left) => (Math.abs(left - here) < Math.abs(best - here) ? left : best))
		// A sixth of the gap between slides counts as meaning to move on
		const spacing = points.length > 1 ? Math.abs(points[1] - points[0]) : track.clientWidth
		const ahead = moved > 0 ? points.find((left) => left > here + 1) : points.findLast((left) => left < here - 1)
		const target = Math.abs(moved) > spacing / 6 && ahead !== undefined ? ahead : nearest

		// Snapping comes back once the glide has landed on a slide, so it doesn't jump
		const snap = () => dragging || track.style.removeProperty('scroll-snap-type')
		if (Math.abs(target - here) < 1) return snap()
		track.addEventListener('scrollend', snap, { once: true })
		setTimeout(snap, 1000)
		track.scrollTo({ left: target, behavior: reducedMotion.matches ? 'auto' : 'smooth' })
	}

	track.addEventListener('pointerup', release)
	track.addEventListener('pointercancel', release)
	track.addEventListener(
		'click',
		(event) => {
			if (!swallowClick) return
			swallowClick = false
			event.preventDefault()
			event.stopPropagation()
		},
		true,
	)
	// Images would otherwise start the browser's own drag
	track.addEventListener('dragstart', (event) => event.preventDefault())
}
