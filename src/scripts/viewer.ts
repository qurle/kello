// Media viewer: opens a post's item uncropped in a <dialog>. Left or right half and the
// arrow keys move between the post's items; Esc closes and focus goes back to the opener.

const dialog = document.querySelector<HTMLDialogElement>('[data-viewer]')!;
const stage = dialog.querySelector<HTMLElement>('[data-viewer-stage]')!;
const meta = dialog.querySelector<HTMLElement>('[data-viewer-meta]')!;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

let items: HTMLElement[] = [];
let index = 0;
let opener: HTMLElement | null = null;

function show() {
	const source = items[index].querySelector('picture, video')!;
	const media = source.cloneNode(true) as HTMLElement;

	media.querySelectorAll('source, img').forEach((element) => element.setAttribute('sizes', '100vw'));
	media.querySelector('img')?.setAttribute('loading', 'eager');

	if (media instanceof HTMLVideoElement) {
		media.removeAttribute('data-autoplay');
		media.preload = 'auto';
		media.muted = true;
		// With reduced motion the video waits for the person to press play.
		if (reducedMotion.matches) media.controls = true;
		else media.autoplay = true;
	}

	stage.replaceChildren(media);
	stage.dataset.side = '';
}

function go(direction: number) {
	const target = index + direction;
	if (target < 0 || target >= items.length) return;
	index = target;
	show();
}

const sideAt = (x: number) => {
	const { left, width } = stage.getBoundingClientRect();
	const direction = x < left + width / 2 ? -1 : 1;
	const target = index + direction;
	return target < 0 || target >= items.length ? 0 : direction;
};

document.addEventListener('click', (event) => {
	const item = (event.target as Element).closest<HTMLElement>('[data-open]');
	if (!item) return;
	const post = item.closest<HTMLElement>('[data-post]')!;

	items = [...post.querySelectorAll<HTMLElement>('[data-open]')];
	index = items.indexOf(item);
	opener = item;

	meta.replaceChildren(post.querySelector('[data-post-meta]')!.cloneNode(true));
	show();
	dialog.showModal();
});

stage.addEventListener('click', (event) => {
	// Native video controls take their own clicks.
	if ((event.target as Element).closest('video[controls]')) return;
	go(sideAt(event.clientX));
});

stage.addEventListener('mousemove', (event) => {
	const side = (event.target as Element).closest('video[controls]') ? 0 : sideAt(event.clientX);
	stage.dataset.side = side < 0 ? 'prev' : side > 0 ? 'next' : '';
});

dialog.addEventListener('keydown', (event) => {
	if (event.key === 'ArrowLeft') go(-1);
	else if (event.key === 'ArrowRight') go(1);
	else return;
	event.preventDefault();
});

dialog.querySelector('[data-viewer-close]')!.addEventListener('click', () => dialog.close());

dialog.addEventListener('close', () => {
	stage.replaceChildren();
	meta.replaceChildren();
	if (opener?.checkVisibility()) opener.focus();
	opener = null;
});

// Picking a tag inside the viewer filters the page behind it.
document.addEventListener('kello:filter', () => {
	if (dialog.open) dialog.close();
});
