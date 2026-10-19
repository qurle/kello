// Tiny click sounds, synthesized with Web Audio: a short sine pop that drops in pitch, no audio files. The
// header switch mutes them, kept in localStorage; Home.astro's head script sets data-muted before the
// first paint, so the switch shows the right state
const root = document.documentElement
let context: AudioContext | undefined

/** Starting pitch in Hz of each kind of click; each drops an octave as it fades */
const pitches = { tap: 1400, on: 1800, off: 1100, step: 1600, open: 1000, close: 700 }
export type Click = keyof typeof pitches

const volume = 0.08
const length = 0.05

export function click(kind: Click = 'tap') {
	if ('muted' in root.dataset) return
	try {
		// Made on the first click, as browsers allow sound only after one
		context ??= new AudioContext()
		const now = context.currentTime
		const tone = context.createOscillator()
		const gain = context.createGain()
		tone.frequency.setValueAtTime(pitches[kind], now)
		tone.frequency.exponentialRampToValueAtTime(pitches[kind] / 2, now + length)
		gain.gain.setValueAtTime(0.0001, now)
		gain.gain.exponentialRampToValueAtTime(volume, now + 0.004)
		gain.gain.exponentialRampToValueAtTime(0.0001, now + length)
		tone.connect(gain).connect(context.destination)
		tone.start(now)
		tone.stop(now + length + 0.01)
	} catch {
		// No Web Audio: silence
	}
}

// Captured, so a tag sounds by its state before the filter flips it
document.addEventListener(
	'click',
	(event) => {
		const target = event.target as Element
		const tag = target.closest('[data-tag]')
		if (tag) click(tag.getAttribute('aria-pressed') === 'true' ? 'off' : 'on')
		else if (target.closest('[data-media-prev], [data-media-next]')) click('step')
		else if (target.closest('[data-theme-switch]')) click()
	},
	true,
)

document.querySelector('[data-sound-switch]')?.addEventListener('click', () => {
	const muted = 'muted' in root.dataset
	if (muted) delete root.dataset.muted
	else root.dataset.muted = ''
	try {
		if (muted) localStorage.removeItem('sound')
		else localStorage.setItem('sound', 'off')
	} catch {
		// No storage: the choice lasts for this page
	}
	if (muted) click('on')
})
