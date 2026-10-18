// Theme switch in the header: auto (the system's), light and dark in turn. The choice is kept in
// localStorage, and the inline script in Home.astro's <head> applies it before the first paint. Tokens
// for each theme are in variables.sass, keyed on html[data-theme].

const themes = ['auto', 'light', 'dark'] as const;
type Theme = (typeof themes)[number];

const root = document.documentElement;

document.querySelector('[data-theme-switch]')?.addEventListener('click', () => {
	const current = (root.dataset.theme as Theme | undefined) ?? 'auto';
	const next = themes[(themes.indexOf(current) + 1) % themes.length];
	if (next === 'auto') delete root.dataset.theme;
	else root.dataset.theme = next;
	try {
		if (next === 'auto') localStorage.removeItem('theme');
		else localStorage.setItem('theme', next);
	} catch {
		// No storage (private mode): the choice lasts for this page.
	}
});
