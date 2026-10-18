// Media viewer: the post's whole row, uncropped, in a full-width carousel inside a <dialog>.
// The current item sits in the middle. Clicking its left or right half, the arrow keys or a swipe
// move between items; clicking a neighbour goes to it. Esc, the close button, or a click anywhere
// outside the media and the post's text closes it, and focus goes back to the opener.
// The open post is kept in the URL as ?post=<id>&media=<n> so it can be shared.

import { getParam, setParams } from './url';

const dialog = document.querySelector<HTMLDialogElement>('[data-viewer]')!;
const track = dialog.querySelector<HTMLElement>('[data-viewer-track]')!;
const meta = dialog.querySelector<HTMLElement>('[data-viewer-meta]')!;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

let slides: HTMLElement[] = [];
let current = 0;
let postId = '';
let opener: HTMLElement | null = null;

/** A copy of a feed item's picture or video, sized for the viewer. */
function slideFor(item: HTMLElement) {
	const media = item.querySelector('picture, video')!.cloneNode(true) as HTMLElement;
	const sized = media.querySelector('img') ?? media;
	const width = Number(sized.getAttribute('width')) || 3;
	const height = Number(sized.getAttribute('height')) || 2;

	media.querySelectorAll('source, img').forEach((element) => element.setAttribute('sizes', 'min(64rem, 100vw)'));
	media.querySelector('img')?.setAttribute('loading', 'eager');
	if (media instanceof HTMLVideoElement) {
		media.removeAttribute('data-autoplay');
		media.preload = 'metadata';
		media.muted = true;
		// With reduced motion a video waits for the person to press play.
		media.controls = reducedMotion.matches;
	}

	const slide = document.createElement('li');
	slide.className = 'viewer__slide';
	slide.style.setProperty('--ratio', `${width} / ${height}`);
	slide.append(media);
	return slide;
}

const smooth = () => (reducedMotion.matches ? 'auto' : 'smooth');

/** Room before the first and after the last slide, so either can sit in the middle. */
function pad() {
	const half = (slide: HTMLElement) => `${(track.clientWidth - slide.offsetWidth) / 2}px`;
	track.style.setProperty('--pad-start', half(slides[0]));
	track.style.setProperty('--pad-end', half(slides.at(-1)!));
}

function scrollTo(index: number, behavior: ScrollBehavior) {
	const slide = slides[index];
	track.scrollTo({ left: slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2, behavior });
}

function setCurrent(index: number) {
	current = index;
	slides.forEach((slide, n) => {
		slide.toggleAttribute('data-current', n === index);
		const video = slide.querySelector('video');
		if (!video || video.controls) return;
		if (n === index) video.play().catch(() => {});
		else video.pause();
	});
	setParams({ post: postId, media: index > 0 ? String(index + 1) : null });
}

function go(index: number) {
	if (index < 0 || index >= slides.length) return;
	setCurrent(index);
	scrollTo(index, smooth());
}

/** The slide whose centre is closest to the track's centre. */
function nearest() {
	const middle = track.scrollLeft + track.clientWidth / 2;
	let best = 0;
	slides.forEach((slide, n) => {
		const distance = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - middle);
		const bestDistance = Math.abs(slides[best].offsetLeft + slides[best].offsetWidth / 2 - middle);
		if (distance < bestDistance) best = n;
	});
	return best;
}

function open(post: HTMLElement, index: number, from: HTMLElement | null) {
	const items = [...post.querySelectorAll<HTMLElement>('[data-open]')];
	if (!items.length) return;
	postId = post.dataset.post!;
	opener = from;
	slides = items.map(slideFor);
	track.replaceChildren(...slides);
	meta.replaceChildren(post.querySelector('[data-post-meta]')!.cloneNode(true));
	dialog.showModal();
	pad();
	const start = Math.min(Math.max(index, 0), slides.length - 1);
	scrollTo(start, 'auto');
	setCurrent(start);
}

document.addEventListener('click', (event) => {
	const item = (event.target as Element).closest<HTMLElement>('[data-open]');
	if (!item || dialog.contains(item)) return;
	const post = item.closest<HTMLElement>('[data-post]')!;
	open(post, [...post.querySelectorAll('[data-open]')].indexOf(item), item);
});

/** -1 or 1 for a point over the current slide's left or right half; 0 at the ends of the row. */
function sideAt(slide: HTMLElement, x: number) {
	const { left, width } = slide.getBoundingClientRect();
	const direction = x < left + width / 2 ? -1 : 1;
	const target = current + direction;
	return target < 0 || target >= slides.length ? 0 : direction;
}

track.addEventListener('click', (event) => {
	const target = event.target as Element;
	// Native video controls take their own clicks.
	if (target.closest('video[controls]')) return;
	const slide = target.closest<HTMLElement>('.viewer__slide');
	if (!slide) return;
	const index = slides.indexOf(slide);
	go(index === current ? current + sideAt(slide, event.clientX) : index);
});

track.addEventListener('mousemove', (event) => {
	const target = event.target as Element;
	const slide = target.closest<HTMLElement>('.viewer__slide');
	const side = slide && slides.indexOf(slide) === current && !target.closest('video[controls]') ? sideAt(slide, event.clientX) : 0;
	track.dataset.side = side < 0 ? 'prev' : side > 0 ? 'next' : '';
});

// Swipes and trackpad scrolls pick the slide that ends up in the middle.
let settle = 0;
track.addEventListener(
	'scroll',
	() => {
		clearTimeout(settle);
		settle = window.setTimeout(() => {
			// Emptying the track on close scrolls it too.
			if (!dialog.open || !slides.length) return;
			const index = nearest();
			if (index !== current) setCurrent(index);
		}, 120);
	},
	{ passive: true },
);

new ResizeObserver(() => {
	if (!dialog.open) return;
	pad();
	scrollTo(current, 'auto');
}).observe(track);

dialog.addEventListener('keydown', (event) => {
	if (event.key === 'ArrowLeft') go(current - 1);
	else if (event.key === 'ArrowRight') go(current + 1);
	else return;
	event.preventDefault();
});

const closeButton = dialog.querySelector<HTMLElement>('[data-viewer-close]')!;

/** Outside the media and the post's text block: the bar, the gaps, the margins. */
const inCloseZone = (target: EventTarget | null) =>
	target instanceof Element && !target.closest('.viewer__slide, .viewer__meta > *');

dialog.addEventListener('click', (event) => {
	if (inCloseZone(event.target)) dialog.close();
});

// The close button lights up wherever a click would close, so the empty space reads as a target.
dialog.addEventListener('pointermove', (event) => {
	const zone = event.pointerType === 'mouse' && inCloseZone(event.target);
	closeButton.toggleAttribute('data-hover', zone);
	dialog.toggleAttribute('data-close-zone', zone);
});

dialog.addEventListener('close', () => {
	clearTimeout(settle);
	closeButton.removeAttribute('data-hover');
	dialog.removeAttribute('data-close-zone');
	track.replaceChildren();
	meta.replaceChildren();
	slides = [];
	setParams({ post: null, media: null });
	if (opener?.checkVisibility()) opener.focus();
	opener = null;
});

// Picking a tag inside the viewer filters the page behind it.
document.addEventListener('kello:filter', () => {
	if (dialog.open) dialog.close();
});

// A shared link opens its post straight away.
const shared = getParam('post');
const sharedPost = shared ? document.querySelector<HTMLElement>(`[data-post="${CSS.escape(shared)}"]`) : null;
if (sharedPost) {
	if (sharedPost.querySelector('[data-open]')) open(sharedPost, Number(getParam('media') ?? 1) - 1, null);
	else sharedPost.scrollIntoView();
}
