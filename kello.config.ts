import { defineConfig } from './src/lib/config';

export default defineConfig({
	site: {
		title: 'Kello',
		// Replace with the production domain once it exists.
		url: 'https://kello.vercel.app',
	},

	channel: {
		username: 'the_kello',
		// A page is ~20 messages; albums take one message per item, so 3 pages are 20–60 posts.
		// A full re-scan runs with `npm run sync -- --full`.
		recentPages: 3,
		// Full-size photos through a bot; see "Full-size photos" in AGENTS.md for the setup.
		bot: {
			tokenEnv: 'TELEGRAM_BOT_TOKEN',
			dumpChatEnv: 'TELEGRAM_DUMP_CHAT_ID',
		},
	},

	media: {
		dir: 'media',
		// Telegram's public pages serve photos at 800px at most, so today each image gets a single 800px file.
		// The larger widths only apply if a bigger source ever comes along.
		widths: [800, 1280, 1920, 2560],
		formats: ['webp'],
		quality: 90,
		maxVideoMB: 15,
	},

	// Filter-line order. Post counts as of Oct 2026 are in comments.
	tags: [
		{ ru: 'ui', en: 'ui' }, // 103
		{ ru: 'вдохновение', en: 'inspiration', aliases: ['вдохнование'] }, // 89
		{ ru: 'знания', en: 'learning' }, // 62
		{ ru: 'портфолио', en: 'portfolio' }, // 25
		{ ru: 'инструменты', en: 'tools', aliases: ['инструементы'] }, // 23
		{ ru: 'ресурсы', en: 'resources' }, // 22
		{ ru: 'код', en: 'code' }, // 21
		{ ru: 'графика', en: 'graphics' }, // 19
		{ ru: 'недизайн', en: 'beyond-design', label: 'beyond design' }, // 12
		{ ru: 'типографика', en: 'typography' }, // 12
		{ ru: 'карьера', en: 'career' }, // 11
		{ ru: 'моушен', en: 'motion' }, // 10
		{ ru: 'сборники', en: 'collections' }, // 9
		{ ru: 'ux', en: 'ux' }, // 9
		{ ru: 'авторы', en: 'people' }, // 9
		{ ru: 'текстуры', en: 'textures' }, // 7
		{ ru: 'дизинж', en: 'design-engineering', label: 'design engineering' }, // 6
		{ ru: 'дизайнсистемы', en: 'design-systems', label: 'design systems' }, // 6
		{ ru: 'мокапы', en: 'mockups' }, // 5
		{ ru: 'текст', en: 'writing' }, // 5
		{ ru: 'цвета', en: 'color' }, // 5
		{ ru: 'шрифты', en: 'fonts', aliases: ['шрифт'] }, // 5
		{ ru: 'фото', en: 'photo' }, // 4
		{ ru: 'пром', en: 'industrial', label: 'industrial design' }, // 3
		{ ru: 'звуки', en: 'sound' }, // 3
		{ ru: 'процессы', en: 'process' }, // 2
		{ ru: 'иллюстрации', en: 'illustration' }, // 2
		{ ru: 'иконки', en: 'icons' }, // 2
		{ ru: 'плагины', en: 'plugins' }, // 1
	],
});
