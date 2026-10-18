// Site languages, from `translate` in kello.config.ts, and the UI strings, lowercase
import config from '../../kello.config'

/** A language code, like `en` */
export type Lang = string

const { enable, from, to } = config.translate

/** The channel's language */
export const original = from
/** The translation at `/`, then the original at `/<from>`; the original alone without translation */
export const languages: Lang[] = enable ? [to, from] : [from]
export const main = languages[0]

const en = {
	description: 'notes on design, interfaces and tools, from the telegram channel the_kello.',
	/** This version's name, for the link to it from another */
	version: 'english version',
	theme: { auto: 'auto', light: 'light', dark: 'dark' },
	themeLabel: 'colour theme',
	filter: 'tags',
	telegram: 'telegram',
	unavailable: 'watch in telegram',
	open: 'open',
	viewer: 'media',
	close: 'close',
	previous: 'previous',
	next: 'next',
	more: 'more',
}

const strings: Record<Lang, typeof en> = {
	en,
	ru: {
		description: 'заметки о дизайне, интерфейсах и инструментах из телеграм-канала the_kello.',
		version: 'русская версия',
		theme: { auto: 'авто', light: 'светлая', dark: 'тёмная' },
		themeLabel: 'цветовая тема',
		filter: 'теги',
		telegram: 'телеграм',
		unavailable: 'смотреть в телеграме',
		open: 'открыть',
		viewer: 'медиа',
		close: 'закрыть',
		previous: 'назад',
		next: 'вперёд',
		more: 'ещё',
	},
}

/** UI strings for a language; English where there are none */
export const ui = (lang: Lang) => strings[lang] ?? en
