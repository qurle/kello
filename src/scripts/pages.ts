// Paged feed: other pages' posts come from their HTML. The next page is fetched at once and its posts go in
// as the "more" link nears; a filter or a shared link loads them all (`loadAll`). New posts go in page
// order and announce themselves with `kello:posts`

const feed = document.querySelector<HTMLElement>('[data-feed]')!
const urls: string[] = JSON.parse(feed.dataset.pages ?? '[]')
const more = document.querySelector<HTMLAnchorElement>('[data-more]')
const loaded = new Map<number, Promise<void>>([[Number(feed.dataset.page), Promise.resolve()]])
const fetched = new Map<number, Promise<HTMLElement[]>>()

async function fetchPage(page: number) {
	// About 15 KB: ahead of the images
	const response = await fetch(urls[page - 1], { priority: 'high' })
	if (!response.ok) throw new Error(`${urls[page - 1]}: ${response.status}`)
	const html = new DOMParser().parseFromString(await response.text(), 'text/html')
	// Parsed without scripting, <noscript> holds elements; as text it waits like this page's (Picture.astro)
	for (const later of html.querySelectorAll('noscript')) later.textContent = later.innerHTML
	return [...html.querySelectorAll<HTMLElement>('[data-feed] > [data-post]')]
}

/** A page's posts, fetched once. A failed fetch is forgotten, so the next call tries again */
function fetchPosts(page: number) {
	if (!fetched.has(page)) {
		const posts = fetchPage(page)
		posts.catch(() => fetched.delete(page))
		fetched.set(page, posts)
	}
	return fetched.get(page)!
}

/** Fetches the next page now, so its posts are ready when the scroll gets there */
function prefetch() {
	const page = nextPage()
	if (page) fetchPosts(page).catch(() => {})
}

/** Before the first post of a later page, so the feed stays newest first */
function insert(page: number, posts: HTMLElement[]) {
	const later = [...feed.querySelectorAll<HTMLElement>(':scope > [data-post]')].find(
		(post) => Number(post.dataset.page) > page,
	)
	for (const post of posts) feed.insertBefore(document.adoptNode(post), later ?? null)
	document.dispatchEvent(new CustomEvent('kello:posts', { detail: posts }))
}

function load(page: number) {
	if (!loaded.has(page)) {
		const loading = fetchPosts(page).then(
			(posts) => insert(page, posts),
			(err) => {
				// Tried again next time; the link still works
				loaded.delete(page)
				throw err
			},
		)
		loaded.set(page, loading)
	}
	return loaded.get(page)!
}

/** The first page after this one that isn't in the feed yet */
const nextPage = () =>
	urls.findIndex((_, i) => i + 1 > Number(feed.dataset.page) && !loaded.has(i + 1)) + 1 || undefined

function updateMore() {
	if (!more) return
	const page = nextPage()
	if (page) more.href = urls[page - 1]
	else more.remove()
}

export async function loadAll() {
	feed.setAttribute('aria-busy', 'true')
	try {
		await Promise.allSettled(urls.map((_, i) => load(i + 1)))
	} finally {
		feed.removeAttribute('aria-busy')
		updateMore()
	}
}

if (more) {
	let busy = false
	const loadNext = async () => {
		const page = nextPage()
		if (busy || !page) return
		busy = true
		try {
			await load(page)
		} catch (err) {
			// No retry loop: the link goes to the page instead
			observer.disconnect()
			throw err
		} finally {
			busy = false
			updateMore()
		}
		prefetch()
		// Observing again reports where the link is now, so a short page loads the next too
		if (more.isConnected) {
			observer.unobserve(more)
			observer.observe(more)
		}
	}
	// Two windows ahead
	const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && loadNext(), {
		rootMargin: '0px 0px 200% 0px',
	})
	observer.observe(more)
	prefetch()
	more.addEventListener('click', (event) => {
		event.preventDefault()
		loadNext().catch(() => (location.href = more.href))
	})
}
