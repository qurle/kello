import { defineConfig } from './src/lib/config'

export default defineConfig({
	site: {
		title: 'kello',
		url: 'https://kello.qurle.net',
		// The line under the heading, per language: `text`, then `link` as a link to `url`. A missing
		// language falls back to the translation's, then the original's
		subtitle: {
			url: 'https://qurle.net',
			lines: {
				en: { text: 'knowledge + inspo collected', link: 'by qurle' },
				ru: { text: 'знания и вдохновение', link: 'от курле' },
			},
		},
		// Posts per page. The first page is the HTML of / (and /<from>); the rest load as the feed's end
		// comes into view, and all of them when a tag is picked
		pageSize: 24,
	},

	channel: {
		username: 'the_kello',
		// A page is ~20 messages; albums take one per item
		recentPages: 3,
		// Full-size photos: see AGENTS.md
		bot: {
			tokenEnv: 'TELEGRAM_BOT_TOKEN',
			dumpChatEnv: 'TELEGRAM_DUMP_CHAT_ID',
		},
	},

	// Posts are translated from the channel's language at sync. The translation is the site's main
	// language at /, the original goes to /<from>. Off, the site is the original only, at /. UI strings
	// exist for en and ru (src/lib/i18n.ts); others fall back to English
	translate: {
		enable: true,
		from: 'ru',
		to: 'en',
	},

	media: {
		dir: 'media',
		// The preview serves photos at 800px; wider files exist only for full-size photos and video posters
		widths: [800, 1280, 1920, 2560],
		formats: ['webp'],
		quality: 90,
		maxVideoMB: 15,
	},

	// Filter-line order; post counts as of Oct 2026
	tags: [
		{ hashtag: 'ui', slug: 'ui' }, // 103
		{ hashtag: 'вдохновение', slug: 'inspiration', aliases: ['вдохнование'] }, // 89
		{ hashtag: 'знания', slug: 'learning', label: 'knowledge' }, // 62
		{ hashtag: 'портфолио', slug: 'portfolio' }, // 25
		{ hashtag: 'инструменты', slug: 'tools', aliases: ['инструементы'] }, // 23
		{ hashtag: 'ресурсы', slug: 'resources' }, // 22
		{ hashtag: 'код', slug: 'code' }, // 21
		{ hashtag: 'графика', slug: 'graphics' }, // 19
		{ hashtag: 'недизайн', slug: 'beyond-design', label: 'beyond design' }, // 12
		{ hashtag: 'типографика', slug: 'typography' }, // 12
		{ hashtag: 'карьера', slug: 'career' }, // 11
		{ hashtag: 'моушен', slug: 'motion' }, // 10
		{ hashtag: 'сборники', slug: 'collections' }, // 9
		{ hashtag: 'ux', slug: 'ux' }, // 9
		{ hashtag: 'авторы', slug: 'people' }, // 9
		{ hashtag: 'текстуры', slug: 'textures' }, // 7
		{ hashtag: 'дизинж', slug: 'design-engineering', label: 'design engineering' }, // 6
		{ hashtag: 'дизайнсистемы', slug: 'design-systems', label: 'design systems' }, // 6
		{ hashtag: 'мокапы', slug: 'mockups' }, // 5
		{ hashtag: 'текст', slug: 'writing' }, // 5
		{ hashtag: 'цвета', slug: 'color' }, // 5
		{ hashtag: 'шрифты', slug: 'fonts', aliases: ['шрифт'] }, // 5
		{ hashtag: 'фото', slug: 'photo' }, // 4
		{ hashtag: 'пром', slug: 'industrial', label: 'industrial design' }, // 3
		{ hashtag: 'звуки', slug: 'sound' }, // 3
		{ hashtag: 'процессы', slug: 'process' }, // 2
		{ hashtag: 'иллюстрации', slug: 'illustration' }, // 2
		{ hashtag: 'иконки', slug: 'icons' }, // 2
		{ hashtag: 'плагины', slug: 'plugins' }, // 1
	],
})
