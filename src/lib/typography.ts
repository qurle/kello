// Typographic fixes applied to post text at build time, in both languages.

/** A hyphen or en dash standing between spaces becomes an em dash: "Toooools - editor" → "Toooools — editor". */
export const emDashes = (html: string) => html.replace(/(\s|&nbsp;)[-–](?=\s|&nbsp;)/g, '$1—');

/** Removes emoji, with their variation selectors, joiners and skin tones, and the space they leave. */
export const stripEmoji = (html: string) =>
	html
		.replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\u{FE0F}\u{200D}]+/gu, '')
		.replace(/[ \t]{2,}/g, ' ')
		.replace(/[ \t]+(<br>|<\/|$)/g, '$1')
		.replace(/(<br>|<[a-z]+>|^)[ \t]+/g, '$1');

/** Every fix, in order. */
export const typeset = (html: string) => emDashes(stripEmoji(html));
