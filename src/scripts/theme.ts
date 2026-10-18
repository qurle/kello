// Theme switch: auto, light and dark in turn, kept in localStorage. Home.astro's head script applies it
// before the first paint
const themes = ['auto', 'light', 'dark']
const root = document.documentElement

document.querySelector('[data-theme-switch]')?.addEventListener('click', () => {
	const next = themes[(themes.indexOf(root.dataset.theme ?? 'auto') + 1) % themes.length]
	if (next === 'auto') delete root.dataset.theme
	else root.dataset.theme = next
	try {
		if (next === 'auto') localStorage.removeItem('theme')
		else localStorage.setItem('theme', next)
	} catch {
		// No storage: the choice lasts for this page
	}
})
