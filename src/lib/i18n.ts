// Every UI string on the site, all lowercase. `/` is English, `/ru` is Russian.
export const strings = {
	en: {
		description: 'notes on design, interfaces and tools, from the telegram channel the_kello.',
		path: '/',
		switchTo: 'ru',
		switchLabel: 'русская версия',
		filter: 'tags',
		telegram: 'telegram',
		unavailable: 'watch in telegram',
		open: 'open',
		viewer: 'media',
		close: 'close',
		previous: 'previous',
		next: 'next',
	},
	ru: {
		description: 'заметки о дизайне, интерфейсах и инструментах из телеграм-канала the_kello.',
		path: '/ru',
		switchTo: 'en',
		switchLabel: 'english version',
		filter: 'теги',
		telegram: 'телеграм',
		unavailable: 'смотреть в телеграме',
		open: 'открыть',
		viewer: 'медиа',
		close: 'закрыть',
		previous: 'назад',
		next: 'вперёд',
	},
} as const;

export type Lang = keyof typeof strings;
