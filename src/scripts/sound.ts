// Tiny click sounds, synthesized with Web Audio, no audio files. Each is a short pattern of ticks, and a tick
// is a snap of band-passed noise over a short triangle body, so actions differ by contour (on rises, off
// falls) as well as pitch. The header switch mutes them, kept in localStorage; Home.astro's head script sets
// data-muted before the first paint, so the switch shows the right state
const root = document.documentElement
let context: AudioContext | undefined
let noise: AudioBuffer | undefined

/** One tick: when it lands (s), its pitch (Hz) and its level (of the voice's full level) */
type Tick = [at: number, pitch: number, level: number]

const voices = {
	// One soft mid tick and its quieter release
	tap: [
		[0, 392, 1],
		[0.035, 392, 0.4],
	],
	// Light and high, a single tick
	step: [[0, 659, 0.8]],
	// On rises, off falls
	on: [
		[0, 440, 0.9],
		[0.05, 659, 0.9],
	],
	off: [
		[0, 659, 0.9],
		[0.05, 440, 0.9],
	],
	// Opening rises from a low press, closing falls back to it
	open: [
		[0, 262, 1],
		[0.06, 392, 0.7],
	],
	close: [
		[0, 392, 0.8],
		[0.06, 262, 1],
	],
} satisfies Record<string, Tick[]>
export type Click = keyof typeof voices

const volume = 0.12
/** The snap: band-pass centre as a multiple of the tick's pitch (higher is crisper), sharpness, attack, length (s) */
const snap = { brightness: 6, q: 1, attack: 0.0005, length: 0.011, level: 0.8 }
/** The body: its wave, length (s), where its pitch sags to by the end, and level */
const body = { wave: 'triangle' as OscillatorType, length: 0.038, sag: 0.76, level: 0.65 }

function makeNoise(audio: AudioContext) {
	const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * 0.03), audio.sampleRate)
	const data = buffer.getChannelData(0)
	for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
	return buffer
}

/** Rises over `attack` (an instant edge is harsh), then fades out over `length` */
function envelope(gain: GainNode, at: number, level: number, attack: number, length: number) {
	gain.gain.setValueAtTime(0.0001, at)
	gain.gain.exponentialRampToValueAtTime(level, at + attack)
	gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
}

function tick(audio: AudioContext, out: AudioNode, at: number, pitch: number, level: number) {
	// The snap: noise around a multiple of the pitch, so higher ticks are brighter
	const source = audio.createBufferSource()
	source.buffer = noise!
	const filter = audio.createBiquadFilter()
	filter.type = 'bandpass'
	filter.frequency.value = pitch * snap.brightness
	filter.Q.value = snap.q
	const snapGain = audio.createGain()
	envelope(snapGain, at, level * snap.level, snap.attack, snap.length)
	source.connect(filter).connect(snapGain).connect(out)
	source.start(at)
	source.stop(at + snap.length + 0.005)

	// The body: a short tone at the pitch, sagging as it fades, which carries the note
	const tone = audio.createOscillator()
	tone.type = body.wave
	tone.frequency.setValueAtTime(pitch, at)
	tone.frequency.exponentialRampToValueAtTime(pitch * body.sag, at + body.length)
	const bodyGain = audio.createGain()
	envelope(bodyGain, at, level * body.level, 0.002, body.length)
	tone.connect(bodyGain).connect(out)
	tone.start(at)
	tone.stop(at + body.length + 0.005)
}

export function click(kind: Click = 'tap') {
	if ('muted' in root.dataset) return
	try {
		// Made on the first click, as browsers allow sound only after one
		context ??= new AudioContext()
		noise ??= makeNoise(context)
		const out = context.createGain()
		out.gain.value = volume
		out.connect(context.destination)
		const now = context.currentTime
		for (const [at, pitch, level] of voices[kind]) tick(context, out, now + at, pitch, level)
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
