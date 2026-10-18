// Media viewer: a post's whole row as a carousel in a <dialog>. The open post and item live in the URL (?post=&media=)

import { reveal } from './media'
import { loadAll } from './pages'
import { getParam, setParams } from './url'

const dialog = document.querySelector<HTMLDialogElement>('[data-viewer]')!
const track = dialog.querySelector<HTMLElement>('[data-viewer-track]')!
const meta = dialog.querySelector<HTMLElement>('[data-viewer-meta]')!
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

let slides: HTMLElement[] = []
let current = 0
let postId = ''
// The item that opened the viewer from the keyboard, which gets focus back on close. Opened by a pointer or a
// shared link there is none: focus stays on the dialog and is let go on close, so no ring shows
let opener: HTMLElement | null = null

/** A copy of a feed item's video or picture */
function slideFor(item: HTMLElement) {
	const media = (item.querySelector('video') ?? item.querySelector('picture'))!.cloneNode(true) as HTMLElement
	const sized = media.querySelector('img') ?? media
	const width = Number(sized.getAttribute('width')) || 16
	const height = Number(sized.getAttribute('height')) || 9

	media.querySelectorAll('source, img').forEach((element) => element.setAttribute('sizes', 'min(64rem, 100vw)'))
	media.querySelector('img')?.setAttribute('loading', 'eager')
	if (media instanceof HTMLVideoElement) {
		media.removeAttribute('data-autoplay')
		// The feed shows the poster as a picture under the video; here it is the video's own poster
		const poster = item.querySelector('img')
		if (poster) media.poster = poster.currentSrc || poster.src
		media.preload = 'metadata'
		media.muted = true
		// Reduced motion: no autoplay, the person presses play
		media.controls = reducedMotion.matches
	}

	const slide = document.createElement('li')
	slide.dataset.slide = ''
	slide.style.setProperty('--ratio', `${width} / ${height}`)
	slide.append(media)
	dither(slide, item, media)
	return slide
}

/** The feed slot's dithered preview (base.sass) on a slide until its picture, or video poster or frame, arrives */
function dither(slide: HTMLElement, item: HTMLElement, media: HTMLElement) {
	const preview = item.closest<HTMLElement>('[data-slot]')?.style.getPropertyValue('--preview')
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
			poster.addEventListener('load', done, { once: true })
			poster.src = media.poster
		}
		return
	}
	const img = media.querySelector('img')
	if (!img) return done()
	img.addEventListener('load', done, { once: true })
	img.addEventListener('error', done, { once: true })
	if (img.complete && img.naturalWidth) done()
}

const smooth = () => (reducedMotion.matches ? 'auto' : 'smooth')

/** Room at both ends, so the first and last slide can sit in the middle */
function pad() {
	const half = (slide: HTMLElement) => `${(track.clientWidth - slide.offsetWidth) / 2}px`
	track.style.setProperty('--pad-start', half(slides[0]))
	track.style.setProperty('--pad-end', half(slides.at(-1)!))
}

function scrollTo(index: number, behavior: ScrollBehavior) {
	const slide = slides[index]
	track.scrollTo({ left: slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2, behavior })
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
	setParams({ post: postId, media: index > 0 ? String(index + 1) : null })
}

function go(index: number) {
	if (index < 0 || index >= slides.length) return
	setCurrent(index)
	scrollTo(index, smooth())
}

/** The slide whose centre is closest to the track's centre */
function nearest() {
	const middle = track.scrollLeft + track.clientWidth / 2
	let best = 0
	slides.forEach((slide, n) => {
		const distance = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - middle)
		const bestDistance = Math.abs(slides[best].offsetLeft + slides[best].offsetWidth / 2 - middle)
		if (distance < bestDistance) best = n
	})
	return best
}

function open(post: HTMLElement, index: number, from: HTMLElement | null) {
	reveal(post)
	const items = [...post.querySelectorAll<HTMLElement>('[data-open]')]
	if (!items.length) return
	postId = post.dataset.post!
	opener = from
	slides = items.map(slideFor)
	track.replaceChildren(...slides)
	meta.replaceChildren(post.querySelector('[data-post-meta]')!.cloneNode(true))
	dialog.showModal()
	// showModal() focuses the close button, which Chrome rings even after a click
	if (!from) dialog.focus()
	pad()
	const start = Math.min(Math.max(index, 0), slides.length - 1)
	scrollTo(start, 'auto')
	setCurrent(start)
}

document.addEventListener('click', (event) => {
	const item = (event.target as Element).closest<HTMLElement>('[data-open]')
	if (!item) return
	const post = item.closest<HTMLElement>('[data-post]')!
	// A click from Enter or Space has no pointer press count
	open(post, [...post.querySelectorAll('[data-open]')].indexOf(item), event.detail === 0 ? item : null)
})

/** -1 or 1 for the left or right half of the current slide; 0 where there is no neighbour */
function sideAt(slide: HTMLElement, x: number) {
	const { left, width } = slide.getBoundingClientRect()
	const direction = x < left + width / 2 ? -1 : 1
	const target = current + direction
	return target < 0 || target >= slides.length ? 0 : direction
}

track.addEventListener('click', (event) => {
	const target = event.target as Element
	// Native video controls keep their clicks
	if (target.closest('video[controls]')) return
	const slide = target.closest<HTMLElement>('[data-slide]')
	if (!slide) return
	const index = slides.indexOf(slide)
	go(index === current ? current + sideAt(slide, event.clientX) : index)
})

track.addEventListener('mousemove', (event) => {
	const target = event.target as Element
	const slide = target.closest<HTMLElement>('[data-slide]')
	const side =
		slide && slides.indexOf(slide) === current && !target.closest('video[controls]') ? sideAt(slide, event.clientX) : 0
	track.dataset.side = side < 0 ? 'prev' : side > 0 ? 'next' : ''
})

// After a swipe or scroll, the slide in the middle becomes current
let settle = 0
track.addEventListener(
	'scroll',
	() => {
		clearTimeout(settle)
		settle = window.setTimeout(() => {
			// Emptying the track on close scrolls it too
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
	scrollTo(current, 'auto')
}).observe(track)

dialog.addEventListener('keydown', (event) => {
	if (event.key === 'ArrowLeft') go(current - 1)
	else if (event.key === 'ArrowRight') go(current + 1)
	else return
	event.preventDefault()
})

const closeButton = dialog.querySelector<HTMLElement>('[data-viewer-close]')!

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
	if (opener?.checkVisibility()) opener.focus()
	// The dialog has already handed focus back to the item, which an Esc rings
	else if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
	opener = null
})

// A tag picked inside the viewer filters the page behind it
document.addEventListener('kello:filter', () => {
	if (dialog.open) dialog.close()
})

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
