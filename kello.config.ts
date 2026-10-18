import { defineConfig } from './src/lib/config';

export default defineConfig({
	site: {
		title: 'Kello',
		// TODO: the production domain.
		url: 'https://kello.vercel.app',
	},

	channel: {
		username: 'the_kello',
		// A page is ~20 messages; albums take one per item.
		recentPages: 3,
		// Full-size photos: see AGENTS.md.
		bot: {
			tokenEnv: 'TELEGRAM_BOT_TOKEN',
			dumpChatEnv: 'TELEGRAM_DUMP_CHAT_ID',
		},
	},

	media: {
		dir: 'media',
		// The preview serves photos at 800px; wider files exist only for full-size photos and video posters.
		widths: [800, 1280, 1920, 2560],
		formats: ['webp'],
		quality: 90,
		maxVideoMB: 15,
	},

	// Filter-line order; post counts as of Oct 2026.
	tags: [
		{ ru: 'ui', en: 'ui' }, // 103
		{ ru: 'вдохновение', en: 'inspiration', aliases: ['вдохнование'] }, // 89
		{ ru: 'знания', en: 'knowledge' }, // 62
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
