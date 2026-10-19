// Temporary, with ?perf: shows how long each click or tap takes to show on screen, split into waiting, handlers
// and rendering, plus long frames and the scripts in them
const panel = document.createElement('pre')
panel.style.cssText =
	'position:fixed;inset:auto 0 0 0;z-index:9999;margin:0;padding:8px;max-height:45vh;overflow:auto;' +
	'font:11px/1.4 ui-monospace,monospace;white-space:pre-wrap;background:rgb(0 0 0 / 0.8);color:#fff;pointer-events:none'
document.body.append(panel)

const lines: string[] = []
const log = (line: string) => {
	lines.unshift(line)
	lines.length = Math.min(lines.length, 30)
	panel.textContent = lines.join('\n')
}

const ms = (value: number) => `${Math.round(value)}ms`
const label = (target: Node | null) =>
	target instanceof Element ? (target.textContent?.trim() || target.tagName.toLowerCase()).slice(0, 20) : '?'

new PerformanceObserver((list) => {
	for (const entry of list.getEntries() as (PerformanceEventTiming & { interactionId: number })[]) {
		if (!entry.interactionId || entry.name !== 'click') continue
		const end = entry.startTime + entry.duration
		const shown = document.querySelectorAll('[data-feed] > [data-post]:not([hidden])').length
		log(
			`"${label(entry.target)}" ${ms(entry.duration)}: wait ${ms(entry.processingStart - entry.startTime)}, ` +
				`js ${ms(entry.processingEnd - entry.processingStart)}, paint ${ms(end - entry.processingEnd)}; ${shown} posts`,
		)
	}
}).observe({ type: 'event', durationThreshold: 16 } as PerformanceObserverInit)

try {
	new PerformanceObserver((list) => {
		for (const frame of list.getEntries() as any[]) {
			const scripts = frame.scripts.map((script: any) => `${script.invoker} ${ms(script.duration)}`).join(', ')
			log(
				`  frame ${ms(frame.duration)}: render ${ms(frame.startTime + frame.duration - frame.renderStart)}, ` +
					`layout ${ms(frame.startTime + frame.duration - frame.styleAndLayoutStart)}${scripts ? `; ${scripts}` : ''}`,
			)
		}
	}).observe({ type: 'long-animation-frame' })
} catch {
	// No long animation frames: taps only
}

// Switches, comma-separated (?perf=still,enabled): what differs between the reset and unticking the last tag
const flags = new Set(new URLSearchParams(location.search).get('perf')?.split(','))
const css: string[] = []
// The settle tilt off, in case 3D animations on every post slow the GPU
if (flags.has('still')) css.push('[data-post] { animation: none !important }')
// No tap highlight, which Android draws on the tapped element and fades out
if (flags.has('flat')) css.push('* { -webkit-tap-highlight-color: transparent }')
// The reset stays enabled under the finger. The observer runs before the next frame, so it never shows disabled
const reset = document.querySelector('[data-tag-reset]')
if (flags.has('enabled') && reset)
	new MutationObserver(() => reset.hasAttribute('disabled') && reset.removeAttribute('disabled')).observe(reset, {
		attributes: true,
		attributeFilter: ['disabled'],
	})
if (css.length) {
	const style = document.createElement('style')
	style.textContent = css.join('\n')
	document.head.append(style)
}

log(`newest on top. switches: ${[...flags].filter(Boolean).join(', ') || 'none'}`)
