// Mouse drag for the scroll-snapped carousels: feed media rows (media.ts) and the viewer (viewer.ts). The
// track follows the pointer with snapping off. On release it coasts: the release speed projects how far it
// would travel, it settles on the slide nearest that point, and a spring takes it there starting at that
// speed. A slow drag past a sixth of a slide still moves on one. Touch and pens keep the browser's own
// scrolling, and a press that doesn't move stays a click

// Feel comes from the --drag-* tokens (variables.sass), read from the track
/** The release speed is measured over the last moves within this many milliseconds */
const sampleWindow = 100
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

/** A token in ms or px as a number, `200ms`, `0.2s` and `6px` alike; the fallback if it's missing */
function token(element: HTMLElement, name: string, fallback: number) {
	const value = getComputedStyle(element).getPropertyValue(name).trim()
	const number = parseFloat(value)
	if (!Number.isFinite(number)) return fallback
	return value.endsWith('s') && !value.endsWith('ms') ? number * 1000 : number
}

/** `snaps` gives the scroll position of each slide, in order */
export function draggable(track: HTMLElement, snaps: () => number[]) {
	let start: { x: number; left: number; threshold: number } | null = null
	let dragging = false
	let swallowClick = false
	let samples: { time: number; left: number }[] = []
	let frame = 0
	// The press stopped a glide midway, so the track sits between slides with snapping off
	let caught = false

	const snap = () => dragging || track.style.removeProperty('scroll-snap-type')
	/** Stops a glide where it is; true if one was running */
	const halt = () => {
		if (!frame) return false
		cancelAnimationFrame(frame)
		frame = 0
		return true
	}
	// A wheel takes over with the browser's own snapping
	track.addEventListener('wheel', () => halt() && snap(), { passive: true })

	track.addEventListener('pointerdown', (event) => {
		if (event.pointerType !== 'mouse' || event.button !== 0) return
		// Native video controls keep their own drags (the viewer under reduced motion)
		if ((event.target as Element).closest('video[controls]')) return
		// Snapping stays off: turning it back on would jump to the nearest slide under the pointer
		caught = halt()
		start = { x: event.clientX, left: track.scrollLeft, threshold: token(track, '--drag-threshold', 6) }
		samples = []
	})

	track.addEventListener('pointermove', (event) => {
		if (!start) return
		const dx = event.clientX - start.x
		if (!dragging) {
			if (Math.abs(dx) < start.threshold) return
			dragging = true
			track.setPointerCapture(event.pointerId)
			track.dataset.dragging = ''
			track.style.scrollSnapType = 'none'
		}
		track.scrollLeft = start.left - dx
		samples.push({ time: event.timeStamp, left: track.scrollLeft })
		while (samples.length > 2 && event.timeStamp - samples[0].time > sampleWindow) samples.shift()
	})

	/** Scroll speed at release, in px/ms; none if the pointer rested before letting go */
	const releaseSpeed = (time: number) => {
		const first = samples[0]
		const last = samples.at(-1)
		if (!first || !last || last === first || time - last.time > 50) return 0
		return (last.left - first.left) / (last.time - first.time)
	}

	const release = (event: PointerEvent) => {
		if (!start) return
		const moved = track.scrollLeft - start.left
		start = null
		// A press that only caught a glide settles on the nearest slide, and isn't a click either
		if (!dragging && !caught) return
		const speed = dragging ? releaseSpeed(event.timeStamp) : 0
		dragging = caught = false
		delete track.dataset.dragging
		// The click that ends a drag isn't one
		swallowClick = true
		setTimeout(() => (swallowClick = false))
		glide(moved, speed)
	}

	const glide = (moved: number, speed: number) => {
		const here = track.scrollLeft
		const max = track.scrollWidth - track.clientWidth
		const points = snaps().map((left) => Math.min(Math.max(left, 0), max))
		const nearestTo = (x: number) =>
			points.reduce((best, left) => (Math.abs(left - x) < Math.abs(best - x) ? left : best))
		const coast = token(track, '--drag-coast', 200)
		// Critically damped, the spring is within 2% of the slide after 6 / rate
		const rate = 6 / Math.max(token(track, '--drag-settle', 500), 1)
		let target = nearestTo(here + speed * coast)
		// A slow drag past a sixth of the gap between slides still means to move on
		const spacing = points.length > 1 ? Math.abs(points[1] - points[0]) : track.clientWidth
		const ahead = moved > 0 ? points.find((left) => left > here + 1) : points.findLast((left) => left < here - 1)
		if (Math.abs(moved) > spacing / 6 && ahead !== undefined && (target - here) * moved <= 0) target = ahead

		// Snapping comes back once the glide has landed on a slide, so it doesn't jump
		if (reducedMotion.matches || Math.abs(target - here) < 1) {
			track.scrollLeft = target
			return snap()
		}
		// Critically damped spring from here, at the release speed, to the target
		const from = here - target
		const begin = performance.now()
		const step = (now: number) => {
			const t = now - begin
			const decay = Math.exp(-rate * t)
			const offset = (from + (speed + rate * from) * t) * decay
			const velocity = (speed - rate * (speed + rate * from) * t) * decay
			track.scrollLeft = target + offset
			if (Math.abs(offset) < 0.5 && Math.abs(velocity) < 0.02) {
				track.scrollLeft = target
				frame = 0
				return snap()
			}
			frame = requestAnimationFrame(step)
		}
		frame = requestAnimationFrame(step)
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
