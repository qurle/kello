// Part of `npm run format` (with `--check`, of `npm run format:check`): formats the frontmatter of
// .astro files with Prettier, as TypeScript, under .prettierrc. Templates and their Sass blocks stay as
// written: prettier-plugin-astro adds whitespace that renders and reindents indented Sass, which
// Prettier can't parse

import { globSync, readFileSync, writeFileSync } from 'node:fs'
import { format, resolveConfig } from 'prettier'

const check = process.argv.includes('--check')
const frontmatter = /^---\n([\s\S]*?)\n?---\n/
const unformatted: string[] = []

for (const file of globSync('src/**/*.astro')) {
	const source = readFileSync(file, 'utf8')
	const match = source.match(frontmatter)
	if (!match) continue
	const options = await resolveConfig(file)
	const code = (await format(match[1], { ...options, parser: 'typescript' })).trimEnd()
	const formatted = source.replace(frontmatter, `---\n${code}\n---\n`)
	if (formatted === source) continue
	unformatted.push(file)
	if (!check) writeFileSync(file, formatted)
}

if (check && unformatted.length) {
	for (const file of unformatted) console.warn(`[warn] ${file}`)
	console.warn('Astro frontmatter isn’t formatted. Run npm run format')
	process.exit(1)
}
