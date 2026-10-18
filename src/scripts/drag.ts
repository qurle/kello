// Mouse drag for scroll-snapped tracks (media rows, the viewer). The track follows the pointer with
// snapping off; on release the speed projects where it would coast, and a spring takes it to the slide
// nearest that point. Feel comes from the --drag-* tokens. Touch and pens keep native scrolling
import { reducedMotion } from './motion'

/** Release speed is measured over this many ms of moves */
const sampleWindow = 100

/** A token as a number, from `200ms`, `0.2s` or `6px` */
function token(element: HTMLElement, name: string, fallback: number) {
	const value = getComputedStyle(element).getPropertyValue(name).trim()
	const number = parseFloat(value)
	if (!Number.isFinite(number)) return fallback
	return value.endsWith('s') && !value.endsWith('ms') ? number * 1000 : number
}

/** `snaps` gives each slide's scroll position, in order */
export function draggable(track: HTMLElement, snaps: () => number[]) {
	let start: { x: number; left: number; threshold: number } | null = null
	let dragging = false
	// The press stopped a glide midway, between slides with snapping off
	let caught = false
	let swallowClick = false
	let samples: { time: number; left: number }[] = []
	let frame = 0

	const snap = () => dragging || track.style.removeProperty('scroll-snap-type')
	const halt = () => {
		if (!frame) return false
		cancelAnimationFrame(frame)
		frame = 0
		return true
	}
	track.addEventListener('wheel', () => halt() && snap(), { passive: true })

	track.addEventListener('pointerdown', (event) => {
		if (event.pointerType !== 'mouse' || event.button !== 0) return
		if ((event.target as Element).closest('video[controls]')) return
		// Snapping stays off, or it would jump to the nearest slide
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

	/** px/ms at release; none if the pointer rested first */
	const releaseSpeed = (time: number) => {
		const first = samples[0]
		const last = samples.at(-1)
		if (!first || !last || first === last || time - last.time > 50) return 0
		return (last.left - first.left) / (last.time - first.time)
	}

	const release = (event: PointerEvent) => {
		if (!start) return
		const moved = track.scrollLeft - start.left
		start = null
		// A press that only caught a glide settles too, and isn't a click
		if (!dragging && !caught) return
		const speed = dragging ? releaseSpeed(event.timeStamp) : 0
		dragging = caught = false
		delete track.dataset.dragging
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
		let target = nearestTo(here + speed * token(track, '--drag-coast', 200))
		// A slow drag past a sixth of a slide still moves on one
		const spacing = points.length > 1 ? Math.abs(points[1] - points[0]) : track.clientWidth
		const ahead = moved > 0 ? points.find((left) => left > here + 1) : points.findLast((left) => left < here - 1)
		if (Math.abs(moved) > spacing / 6 && ahead !== undefined && (target - here) * moved <= 0) target = ahead

		if (reducedMotion.matches || Math.abs(target - here) < 1) {
			track.scrollLeft = target
			return snap()
		}
		// Critically damped spring, within 2% of the target after --drag-settle
		const rate = 6 / Math.max(token(track, '--drag-settle', 500), 1)
		const from = here - target
		const begin = performance.now()
		const step = (now: number) => {
			const t = now - begin
			const decay = Math.exp(-rate * t)
			const offset = (from + (speed + rate * from) * t) * decay
			const velocity = (speed - rate * (speed + rate * from) * t) * decay
			if (Math.abs(offset) < 0.5 && Math.abs(velocity) < 0.02) {
				track.scrollLeft = target
				frame = 0
				return snap()
			}
			track.scrollLeft = target + offset
			frame = requestAnimationFrame(step)
		}
		frame = requestAnimationFrame(step)
	}

	track.addEventListener('pointerup', release)
	track.addEventListener('pointercancel', release)
	// The click that ends a drag isn't one
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
	track.addEventListener('dragstart', (event) => event.preventDefault())
}
