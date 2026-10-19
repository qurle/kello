// Media viewer: a post's row as a carousel in a <dialog>, its post and item in the URL (?post=&media=)
import { draggable } from './drag'
import { onLoad, reveal } from './media'
import { reducedMotion, scrollBehavior } from './motion'
import { loadAll } from './pages'
import { getParam, setParams } from './url'

const dialog = document.querySelector<HTMLDialogElement>('[data-viewer]')!
const track = dialog.querySelector<HTMLElement>('[data-viewer-track]')!
const meta = dialog.querySelector<HTMLElement>('[data-viewer-meta]')!
const closeButton = dialog.querySelector<HTMLElement>('[data-viewer-close]')!

let slides: HTMLElement[] = []
let current = 0

/** A copy of a feed item's video or picture. `near` slides load now, the rest as they come close */
function slideFor(item: HTMLElement, near: boolean) {
	const media = (item.querySelector('video') ?? item.querySelector('picture'))!.cloneNode(true) as HTMLElement
	const sized = media.querySelector('img') ?? media
	const ratio = (Number(sized.getAttribute('width')) || 16) / (Number(sized.getAttribute('height')) || 9)

	// The slide's width, as Viewer.astro sizes it, so a portrait image doesn't fetch a landscape's file
	const style = getComputedStyle(track)
	const height = style.getPropertyValue('--viewer-media-height').trim().replace('dvh', 'vh')
	const sizes = `min(calc(${height} * ${ratio.toFixed(3)}), ${style.getPropertyValue('--viewer-media-max').trim()}, 100vw)`
	media.querySelectorAll('source, img').forEach((element) => element.setAttribute('sizes', sizes))
	const img = media.querySelector('img')
	if (img) img.loading = near ? 'eager' : 'lazy'

	if (media instanceof HTMLVideoElement) {
		media.removeAttribute('data-autoplay')
		// In the feed the poster is a picture under the video
		const poster = item.querySelector('img')
		if (poster) media.poster = poster.currentSrc || poster.src
		media.preload = 'none'
		media.muted = true
		media.controls = reducedMotion.matches
	}

	const slide = document.createElement('li')
	slide.dataset.slide = ''
	slide.style.setProperty('--ratio', String(ratio))
	slide.append(media)
	placeholder(slide, item, media)
	return slide
}

/**
 * Until the picture, or the video's poster or frame, arrives: the feed's copy scaled up if it has loaded,
 * otherwise the slot's dithered preview (base.sass)
 */
function placeholder(slide: HTMLElement, item: HTMLElement, media: HTMLElement) {
	const shown = item.querySelector('img')
	const loaded = shown?.complete && shown.naturalWidth > 0 ? shown.currentSrc : ''
	const preview = item.closest<HTMLElement>('[data-slot]')?.style.getPropertyValue('--preview')
	// The feed's copy is the same picture, so the full one draws straight over it: nothing to hide or fade in,
	// which over a blurry copy would flicker
	if (loaded) {
		slide.style.backgroundImage = `url("${loaded}")`
		return
	}
	if (!preview) return
	const done = () => slide.removeAttribute('data-loading')
	slide.dataset.dither = ''
	slide.dataset.loading = ''
	slide.style.setProperty('--preview', preview)
	const mark = document.createElement('span')
	mark.className = 'dither'
	mark.ariaHidden = 'true'
	slide.prepend(mark)

	if (media instanceof HTMLVideoElement) {
		media.addEventListener('loadeddata', done, { once: true })
		if (media.poster) {
			const poster = new Image()
			poster.src = media.poster
			onLoad(poster, done)
		}
	} else {
		const img = media.querySelector('img')
		if (img) onLoad(img, done)
		else done()
	}
}

/** Scroll position that centres a slide */
const centre = (slide: HTMLElement) => slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2

/** Room at both ends, so the first and last slides can sit in the middle */
function pad() {
	const half = (slide: HTMLElement) => `${(track.clientWidth - slide.offsetWidth) / 2}px`
	track.style.setProperty('--pad-start', half(slides[0]))
	track.style.setProperty('--pad-end', half(slides.at(-1)!))
}

function setCurrent(index: number) {
	current = index
	slides.forEach((slide, n) => {
		slide.toggleAttribute('data-current', n === index)
		const video = slide.querySelector('video')
		if (!video || video.controls) return
		if (n === index) video.play().catch(() => {})
		else video.pause()
	})
	setParams({ media: index > 0 ? String(index + 1) : null })
}

function go(index: number) {
	if (index < 0 || index >= slides.length) return
	setCurrent(index)
	track.scrollTo({ left: centre(slides[index]), behavior: scrollBehavior() })
}

/** The slide closest to the middle */
const nearest = () =>
	slides.reduce(
		(best, slide, n) =>
			Math.abs(centre(slide) - track.scrollLeft) < Math.abs(centre(slides[best]) - track.scrollLeft) ? n : best,
		0,
	)

/**
 * `from` is the item that opened the viewer by keyboard, which gets focus back on close. Opened by a
 * pointer or a link, focus stays on the dialog and is let go on close, so no ring shows
 */
function open(post: HTMLElement, index: number, from: HTMLElement | null) {
	reveal(post)
	const items = [...post.querySelectorAll<HTMLElement>('[data-open]')]
	if (!items.length) return
	const start = Math.min(Math.max(index, 0), items.length - 1)
	setParams({ post: post.dataset.post! })
	slides = items.map((item, n) => slideFor(item, Math.abs(n - start) <= 1))
	track.replaceChildren(...slides)
	meta.replaceChildren(post.querySelector('[data-post-meta]')!.cloneNode(true))
	dialog.showModal()
	// showModal() focuses the close button, which Chrome rings even after a click
	if (!from) dialog.focus()
	dialog.addEventListener(
		'close',
		() => {
			if (from?.checkVisibility()) from.focus()
			// The dialog has handed focus back to the item already, which an Esc rings
			else if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
		},
		{ once: true },
	)
	pad()
	track.scrollLeft = centre(slides[start])
	setCurrent(start)
}

document.addEventListener('click', (event) => {
	const item = (event.target as Element).closest<HTMLElement>('[data-open]')
	if (!item) return
	const post = item.closest<HTMLElement>('[data-post]')!
	// Enter or Space make a click with no press count
	open(post, [...post.querySelectorAll('[data-open]')].indexOf(item), event.detail === 0 ? item : null)
})

// A click on the current slide steps by its half; on another slide, goes there
track.addEventListener('click', (event) => {
	const target = event.target as Element
	if (target.closest('video[controls]')) return
	const slide = target.closest<HTMLElement>('[data-slide]')
	if (!slide) return
	const index = slides.indexOf(slide)
	if (index !== current) return go(index)
	const { left, width } = slide.getBoundingClientRect()
	go(current + (event.clientX < left + width / 2 ? -1 : 1))
})

draggable(track, () => slides.map(centre))

// After a swipe or scroll, the slide in the middle becomes current
let settle = 0
track.addEventListener(
	'scroll',
	() => {
		clearTimeout(settle)
		settle = window.setTimeout(() => {
			if (!dialog.open || !slides.length) return
			const index = nearest()
			if (index !== current) setCurrent(index)
		}, 120)
	},
	{ passive: true },
)

new ResizeObserver(() => {
	if (!dialog.open) return
	pad()
	track.scrollLeft = centre(slides[current])
}).observe(track)

dialog.addEventListener('keydown', (event) => {
	if (event.key === 'ArrowLeft') go(current - 1)
	else if (event.key === 'ArrowRight') go(current + 1)
	else return
	event.preventDefault()
})

/** Anywhere outside the media and the post's text */
const inCloseZone = (target: EventTarget | null) =>
	target instanceof Element && !target.closest('[data-slide], [data-viewer-meta] > *')

dialog.addEventListener('click', (event) => {
	if (inCloseZone(event.target)) dialog.close()
})

// The close button lights up wherever a click would close
dialog.addEventListener('pointermove', (event) => {
	const zone = event.pointerType === 'mouse' && inCloseZone(event.target)
	closeButton.toggleAttribute('data-hover', zone)
	dialog.toggleAttribute('data-close-zone', zone)
})

dialog.addEventListener('close', () => {
	clearTimeout(settle)
	closeButton.removeAttribute('data-hover')
	dialog.removeAttribute('data-close-zone')
	track.replaceChildren()
	meta.replaceChildren()
	slides = []
	setParams({ post: null, media: null })
})

// A tag picked in the viewer filters the page behind it
document.addEventListener('kello:filter', () => dialog.open && dialog.close())

// A shared link opens its post, loading the other pages if it isn't on this one
const shared = getParam('post')
if (shared) {
	const find = () => document.querySelector<HTMLElement>(`[data-feed] > [data-post="${CSS.escape(shared)}"]`)
	const show = (post: HTMLElement | null) => {
		if (post?.querySelector('[data-open]')) open(post, (Number(getParam('media')) || 1) - 1, null)
		else post?.scrollIntoView()
	}
	if (find()) show(find())
	else loadAll().then(() => show(find()))
}
