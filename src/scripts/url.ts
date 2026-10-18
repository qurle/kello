// Query string shared by the filter and the viewer, written with replaceState so history stays clean

const langLink = document.querySelector<HTMLAnchorElement>('[data-lang-link]')
const langPath = langLink?.pathname

export const getParam = (name: string) => new URLSearchParams(location.search).get(name)

/** Sets params, or removes them with `null`. The language link carries the same query */
export function setParams(changes: Record<string, string | null>) {
	const params = new URLSearchParams(location.search)
	for (const [name, value] of Object.entries(changes)) {
		if (value) params.set(name, value)
		else params.delete(name)
	}
	// Keep commas readable in ?tags=a,b
	const query = [...params]
		.map(([name, value]) => `${name}=${encodeURIComponent(value).replaceAll('%2C', ',')}`)
		.join('&')
	const search = query ? `?${query}` : ''
	history.replaceState(history.state, '', location.pathname + search + location.hash)
	if (langLink) langLink.href = langPath + search
}
