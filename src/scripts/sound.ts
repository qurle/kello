// Tiny click sounds, synthesized with Web Audio, no audio files: a mechanical press. A crisp snap of
// band-passed noise over a short low thump, then a fainter release snap. The header switch mutes them, kept
// in localStorage; Home.astro's head script sets data-muted before the first paint, so the switch shows the
// right state
const root = document.documentElement
let context: AudioContext | undefined
let noise: AudioBuffer | undefined

/** Each kind's snap (band-pass centre, Hz: higher is brighter) and body (thump pitch, Hz: lower is fuller) */
const voices = {
	tap: { snap: 4000, body: 220 },
	on: { snap: 5000, body: 260 },
	off: { snap: 3200, body: 190 },
	step: { snap: 4500, body: 240 },
	open: { snap: 3000, body: 160 },
	close: { snap: 2600, body: 140 },
}
export type Click = keyof typeof voices

const volume = 0.4
/** Snap length; the body rings a little longer */
const snapLength = 0.012
const bodyLength = 0.03
/** The release snap: this long after the press, at this share of its level */
const release = { delay: 0.03, level: 0.35 }

function makeNoise(audio: AudioContext) {
	const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * 0.03), audio.sampleRate)
	const data = buffer.getChannelData(0)
	for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
	return buffer
}

/** Noise through a band-pass, from full at once down to nothing: the crisp part */
function snap(audio: AudioContext, out: AudioNode, at: number, frequency: number, level: number) {
	const source = audio.createBufferSource()
	source.buffer = noise!
	const filter = audio.createBiquadFilter()
	filter.type = 'bandpass'
	filter.frequency.value = frequency
	filter.Q.value = 1.2
	const gain = audio.createGain()
	gain.gain.setValueAtTime(level, at)
	gain.gain.exponentialRampToValueAtTime(0.001, at + snapLength)
	source.connect(filter).connect(gain).connect(out)
	source.start(at)
	source.stop(at + snapLength + 0.005)
}

/** A short low thump that sags in pitch: the body of the switch */
function body(audio: AudioContext, out: AudioNode, at: number, frequency: number, level: number) {
	const tone = audio.createOscillator()
	tone.type = 'triangle'
	tone.frequency.setValueAtTime(frequency, at)
	tone.frequency.exponentialRampToValueAtTime(frequency * 0.6, at + bodyLength)
	const gain = audio.createGain()
	gain.gain.setValueAtTime(0.0001, at)
	gain.gain.exponentialRampToValueAtTime(level, at + 0.002)
	gain.gain.exponentialRampToValueAtTime(0.0001, at + bodyLength)
	tone.connect(gain).connect(out)
	tone.start(at)
	tone.stop(at + bodyLength + 0.005)
}

export function click(kind: Click = 'tap') {
	if ('muted' in root.dataset) return
	try {
		// Made on the first click, as browsers allow sound only after one
		context ??= new AudioContext()
		noise ??= makeNoise(context)
		const { snap: brightness, body: pitch } = voices[kind]
		const out = context.createGain()
		out.gain.value = volume
		out.connect(context.destination)
		const now = context.currentTime
		snap(context, out, now, brightness, 1)
		body(context, out, now, pitch, 0.3)
		snap(context, out, now + release.delay, brightness * 1.15, release.level)
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
