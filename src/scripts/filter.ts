// Tag filter: AND over the selected tags, kept in the URL as ?tags=a,b. A selection covers every
// page of the feed, so picking a tag loads the pages not yet in it first
import { loadAll } from './pages'
import { getParam, setParams } from './url'

const root = document.documentElement
const reset = document.querySelector<HTMLButtonElement>('[data-tag-reset]')
const known = new Set(
	[...document.querySelectorAll<HTMLElement>('[data-filter] [data-tag]')].map((button) => button.dataset.tag!),
)
const selected = new Set((getParam('tags') ?? '').split(',').filter((tag) => known.has(tag)))

const tagsOf = (post: HTMLElement) => new Set((post.dataset.tags ?? '').split(' ').filter(Boolean))
const matches = (tags: Set<string>) => [...selected].every((tag) => tags.has(tag))

function apply() {
	const visible: Set<string>[] = []
	for (const post of document.querySelectorAll<HTMLElement>('[data-feed] > [data-post]')) {
		const tags = tagsOf(post)
		post.hidden = !matches(tags)
		if (!post.hidden) visible.push(tags)
	}

	for (const button of document.querySelectorAll<HTMLButtonElement>('[data-tag]')) {
		const tag = button.dataset.tag!
		const on = selected.has(tag)
		button.setAttribute('aria-pressed', String(on))
		// A tag that would leave no posts can't be picked
		if (button.closest('[data-filter]'))
			button.disabled = !on && selected.size > 0 && !visible.some((tags) => tags.has(tag))
	}

	if (reset) reset.disabled = !selected.size
	setParams({ tags: selected.size ? [...selected].join(',') : null })
}

async function update() {
	if (selected.size) await loadAll()
	apply()
	delete root.dataset.filtering
	document.dispatchEvent(new CustomEvent('kello:filter'))
}

// A press doesn't focus a tag or the reset; Tab and Enter still do. On Android, focus moving to another button in
// the frame that brought every post back doubled its time to paint
document.addEventListener('mousedown', (event) => {
	if ((event.target as Element).closest('[data-tag], [data-tag-reset]')) event.preventDefault()
})

reset?.addEventListener('click', (event) => {
	selected.clear()
	update()
	// The button is disabled again, so after Enter or Space (a click with no press count) focus moves to the
	// first tag
	if (event.detail === 0) document.querySelector<HTMLElement>('[data-filter] [data-tag]')?.focus()
})

document.addEventListener('click', (event) => {
	const button = (event.target as Element).closest<HTMLButtonElement>('[data-tag]')
	if (!button || button.disabled) return
	const tag = button.dataset.tag!
	if (!selected.delete(tag)) selected.add(tag)
	update()
})

// Posts from another page follow the current selection
document.addEventListener('kello:posts', () => apply())

if (selected.size) update()
else {
	apply()
	delete root.dataset.filtering
}
