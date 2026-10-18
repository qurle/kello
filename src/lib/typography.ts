/** Build-time typography for post text: a hyphen or en dash between spaces becomes an em dash */
export const typeset = (html: string) => html.replace(/(\s|&nbsp;)[-–](?=\s|&nbsp;)/g, '$1—')
