// Paged feed: a page's HTML holds its own posts, and the others come from their pages' HTML. The next
// page loads as the "more" link nears the window; every page loads when a filter or a shared link needs
// them (`loadAll`). New posts go in page order and announce themselves with `kello:posts`.

const feed = document.querySelector<HTMLElement>('[data-feed]')!;
const urls: string[] = JSON.parse(feed.dataset.pages ?? '[]');
const more = document.querySelector<HTMLAnchorElement>('[data-more]');
const loaded = new Map<number, Promise<void>>([[Number(feed.dataset.page), Promise.resolve()]]);

async function fetchPosts(page: number) {
	const response = await fetch(urls[page - 1]);
	if (!response.ok) throw new Error(`${urls[page - 1]}: ${response.status}`);
	const html = new DOMParser().parseFromString(await response.text(), 'text/html');
	return [...html.querySelectorAll<HTMLElement>('[data-feed] > [data-post]')];
}

/** Before the first post of a later page, so the feed stays newest first. */
function insert(page: number, posts: HTMLElement[]) {
	const later = [...feed.querySelectorAll<HTMLElement>(':scope > [data-post]')].find((post) => Number(post.dataset.page) > page);
	for (const post of posts) feed.insertBefore(document.adoptNode(post), later ?? null);
	document.dispatchEvent(new CustomEvent('kello:posts', { detail: posts }));
}

function load(page: number) {
	if (!loaded.has(page)) {
		const loading = fetchPosts(page).then(
			(posts) => insert(page, posts),
			(err) => {
				// Try again next time; the "more" link still works as a link.
				loaded.delete(page);
				throw err;
			},
		);
		loaded.set(page, loading);
	}
	return loaded.get(page)!;
}

/** The first page after this one that isn't in the feed yet. */
const nextPage = () => urls.findIndex((_, i) => i + 1 > Number(feed.dataset.page) && !loaded.has(i + 1)) + 1 || undefined;

function updateMore() {
	if (!more) return;
	const page = nextPage();
	if (page) more.href = urls[page - 1];
	else more.remove();
}

export async function loadAll() {
	feed.setAttribute('aria-busy', 'true');
	try {
		await Promise.allSettled(urls.map((_, i) => load(i + 1)));
	} finally {
		feed.removeAttribute('aria-busy');
		updateMore();
	}
}

if (more) {
	let busy = false;
	const loadNext = async () => {
		const page = nextPage();
		if (busy || !page) return;
		busy = true;
		try {
			await load(page);
		} catch (err) {
			// No retry loop: scrolling stops loading, and the link goes to the page.
			observer.disconnect();
			throw err;
		} finally {
			busy = false;
			updateMore();
		}
		// Observing again reports where the link is now, so a short page loads the next one too.
		if (more.isConnected) {
			observer.unobserve(more);
			observer.observe(more);
		}
	};
	// About two windows ahead, so posts are in place before the scroll gets there.
	const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && loadNext(), {
		rootMargin: '0px 0px 200% 0px',
	});
	observer.observe(more);
	more.addEventListener('click', (event) => {
		event.preventDefault();
		loadNext().catch(() => (location.href = more.href));
	});
}
