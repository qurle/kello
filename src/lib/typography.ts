// Typographic fixes applied to post text at build time, in both languages.

/** A hyphen or en dash standing between spaces becomes an em dash: "Toooools - editor" → "Toooools — editor". */
export const emDashes = (html: string) => html.replace(/(\s|&nbsp;)[-–](?=\s|&nbsp;)/g, '$1—');

/** Every fix, in order. */
export const typeset = (html: string) => emDashes(html);
