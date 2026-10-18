// Typographic fixes applied to post text at build time.

/** A hyphen or en dash between spaces becomes an em dash. */
export const emDashes = (html: string) => html.replace(/(\s|&nbsp;)[-–](?=\s|&nbsp;)/g, '$1—');

export const typeset = (html: string) => emDashes(html);
