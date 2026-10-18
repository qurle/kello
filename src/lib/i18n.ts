// Every UI string on the site. `/` is English, `/ru` is Russian.
export const strings = {
	en: {
		description: 'Notes on design, interfaces and tools, from the Telegram channel the_kello.',
		path: '/',
		switchTo: 'ru',
		switchLabel: 'Русская версия',
		filter: 'Tags',
		telegram: 'telegram',
		unavailable: 'Watch in Telegram',
		open: 'Open',
		viewer: 'Media',
		close: 'close',
		previous: 'Previous',
		next: 'Next',
	},
	ru: {
		description: 'Заметки о дизайне, интерфейсах и инструментах из телеграм-канала the_kello.',
		path: '/ru',
		switchTo: 'en',
		switchLabel: 'English version',
		filter: 'Теги',
		telegram: 'телеграм',
		unavailable: 'Смотреть в Телеграме',
		open: 'Открыть',
		viewer: 'Медиа',
		close: 'закрыть',
		previous: 'Назад',
		next: 'Вперёд',
	},
} as const;

export type Lang = keyof typeof strings;
