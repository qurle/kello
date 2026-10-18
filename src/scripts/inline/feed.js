// Inlined after the feed (Home.astro) so it runs before the first paint. Clears the loading dither as
// images arrive and scatters the feed on wide screens, for this page and for posts from others (`kello:posts`)
;(() => {
	const root = document.documentElement
	const feed = document.querySelector('[data-feed]')
	if (!feed) return

	const watch = (scope) => {
		for (const img of scope.querySelectorAll('[data-loading] img')) {
			const done = () => img.closest('[data-loading]').removeAttribute('data-loading')
			if (img.complete) done()
			else {
				img.addEventListener('load', done, { once: true })
				img.addEventListener('error', done, { once: true })
			}
		}
	}
	watch(feed)

	const wide = matchMedia('(min-width: 64rem)')

	/** Tokens in px, whatever their units, measured in one layout */
	const lengths = (...names) => {
		const probe = document.createElement('div')
		probe.style.cssText = 'position:absolute;visibility:hidden'
		probe.innerHTML = names.map((name) => `<i style="display:block;width:var(${name})"></i>`).join('')
		feed.append(probe)
		const px = [...probe.children].map((child) => child.offsetWidth)
		probe.remove()
		return px
	}

	const number = (name) => Number(getComputedStyle(feed).getPropertyValue(name)) || 0

	const reset = () => {
		feed.removeAttribute('data-scatter')
		feed.style.height = ''
		for (const post of feed.querySelectorAll('[data-post]')) {
			post.style.removeProperty('inset')
			post.style.removeProperty('width')
		}
	}

	const layout = () => {
		if (!wide.matches) return reset()

		const columns = number('--scatter-columns')
		const span = number('--scatter-span')
		const [gap, rowGap, jitter] = lengths('--scatter-gap', '--scatter-row-gap', '--scatter-jitter')
		const column = (feed.clientWidth - (columns - 1) * gap) / columns
		const width = span * column + (span - 1) * gap
		const visible = [...feed.querySelectorAll('[data-post]:not([hidden])')]

		feed.setAttribute('data-scatter', '')
		// All widths, then all heights: two layouts rather than one per post
		for (const post of visible) post.style.width = `${width}px`
		const heights = visible.map((post) => post.offsetHeight)

		const skyline = new Array(columns).fill(0)
		let previousTop = 0
		let previousStart = -1

		visible.forEach((post, index) => {
			const h = Number(post.dataset.hash)
			// Never above the previous post, never in its column
			const options = Array.from({ length: columns - span + 1 }, (_, start) => ({
				start,
				top: Math.max(...skyline.slice(start, start + span), previousTop),
			})).filter(({ start }) => start !== previousStart)
			const highest = Math.min(...options.map((option) => option.top))
			const near = options.filter((option) => option.top <= highest + jitter)
			const { start, top: floor } = near[h % near.length]
			const top = floor + (index === 0 ? 0 : ((h >>> 16) % 1000) / 1000) * jitter

			post.style.inset = `${top}px auto auto ${start * (column + gap)}px`
			for (let c = start; c < start + span; c++) skyline[c] = top + heights[index] + rowGap
			previousTop = top
			previousStart = start
		})

		feed.style.height = `${Math.max(0, ...skyline) - rowGap}px`
	}

	const safe = () => {
		try {
			layout()
		} catch (err) {
			// The single column, rather than a hidden feed
			delete root.dataset.js
			reset()
			throw err
		}
	}

	wide.addEventListener('change', safe)
	document.addEventListener('kello:filter', safe)
	document.addEventListener('kello:posts', ({ detail }) => {
		for (const post of detail) watch(post)
		// After the other listeners, so the filter has hidden what it hides
		queueMicrotask(safe)
	})
	document.fonts.ready.then(safe)
	// Only width changes matter: the height is ours
	let lastWidth = feed.clientWidth
	new ResizeObserver(([entry]) => {
		if (entry.contentRect.width === lastWidth) return
		lastWidth = entry.contentRect.width
		safe()
	}).observe(feed)
	safe()
})()
