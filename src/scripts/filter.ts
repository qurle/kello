// Tag filter: AND over the selected tags, kept in the URL as ?tags=a,b.

const posts = [...document.querySelectorAll<HTMLElement>('[data-post]')];
const postTags = posts.map((post) => new Set((post.dataset.tags ?? '').split(' ').filter(Boolean)));
const known = new Set(postTags.flatMap((tags) => [...tags]));
const langLink = document.querySelector<HTMLAnchorElement>('[data-lang-link]');
const langPath = langLink?.pathname;

const fromUrl = new URLSearchParams(location.search).get('tags') ?? '';
const selected = new Set(fromUrl.split(',').filter((tag) => known.has(tag)));

const matches = (tags: Set<string>) => [...selected].every((tag) => tags.has(tag));

function apply() {
	const visible = postTags.filter(matches);
	posts.forEach((post, index) => (post.hidden = !matches(postTags[index])));

	for (const button of document.querySelectorAll<HTMLButtonElement>('[data-tag]')) {
		const tag = button.dataset.tag!;
		const on = selected.has(tag);
		button.setAttribute('aria-pressed', String(on));
		// A tag that would leave nothing to show can't be picked.
		if (button.closest('[data-filter]')) button.disabled = !on && selected.size > 0 && !visible.some((tags) => tags.has(tag));
	}

	const search = selected.size ? `?tags=${[...selected].map(encodeURIComponent).join(',')}` : '';
	history.replaceState(history.state, '', location.pathname + search + location.hash);
	if (langLink) langLink.href = langPath + search;
}

document.addEventListener('click', (event) => {
	const button = (event.target as Element).closest<HTMLButtonElement>('[data-tag]');
	if (!button || button.disabled) return;
	const tag = button.dataset.tag!;
	if (!selected.delete(tag)) selected.add(tag);
	apply();
	document.dispatchEvent(new CustomEvent('kello:filter'));
});

apply();
