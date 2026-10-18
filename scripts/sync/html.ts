import { isTag, isText, type AnyNode, type Element } from 'domhandler';

// Formatting kept on the site; other tags are unwrapped.
const keep: Record<string, string> = {
	b: 'b',
	strong: 'b',
	i: 'i',
	em: 'i',
	u: 'u',
	ins: 'u',
	s: 's',
	del: 's',
	strike: 's',
	code: 'code',
	pre: 'code',
	blockquote: 'blockquote',
	a: 'a',
};

const escapeText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s: string) => escapeText(s).replace(/"/g, '&quot;');

export const isHashtagLink = (node: AnyNode): boolean =>
	isTag(node) && node.name === 'a' && (node.attribs.href ?? '').startsWith('?q=');

/** `?q=%23ui` → `ui` */
export const hashtagOf = (el: Element) =>
	decodeURIComponent(el.attribs.href.slice(3)).replace(/^#/, '').trim().toLowerCase();

const isSafeHref = (href: string) => /^(https?:|mailto:|tg:)/i.test(href);

/** Serialises nodes to the HTML subset; only `href` survives as an attribute. */
export function serialize(nodes: AnyNode[]): string {
	let out = '';
	for (const node of nodes) {
		if (isText(node)) {
			out += escapeText(node.data);
			continue;
		}
		if (!isTag(node)) continue;
		const el = node;
		if (el.name === 'br') {
			out += '<br>';
			continue;
		}
		// Hashtags off the leading line become plain text.
		if (isHashtagLink(el)) {
			out += escapeText(textOf(el));
			continue;
		}
		// Custom emoji: `<i class="emoji"><b>❤</b></i>`.
		if (/\bemoji\b/.test(el.attribs.class ?? '') || el.name === 'tg-emoji') {
			out += escapeText(textOf(el));
			continue;
		}
		const inner = serialize(el.children);
		const tag = keep[el.name];
		if (!tag) {
			out += inner;
		} else if (tag === 'a') {
			const href = el.attribs.href ?? '';
			out += isSafeHref(href) ? `<a href="${escapeAttr(href)}">${inner}</a>` : inner;
		} else if (inner.trim()) {
			out += `<${tag}>${inner}</${tag}>`;
		} else {
			out += inner;
		}
	}
	return out;
}

export function textOf(node: AnyNode): string {
	if (isText(node)) return node.data;
	if (isTag(node)) return node.children.map(textOf).join('');
	return '';
}

const isBlank = (node: AnyNode) =>
	(isText(node) && !node.data.trim()) || (isTag(node) && node.name === 'br');

const looksLikeUrl = (s: string) => /^(https?:\/\/|www\.)\S+$/i.test(s.trim());

export interface ParsedText {
	tags: string[];
	html: string;
	link?: string;
}

/**
 * Splits a message text element into hashtags, body HTML and source link.
 * Hashtags come from `?q=` links, not text: `textContent` drops `<br>` and glues `#ui` to the next word.
 */
export function parseText(root: Element | undefined): ParsedText {
	if (!root) return { tags: [], html: '' };
	const nodes = [...root.children];
	const tags = new Set<string>();
	root.children.forEach(function collect(node: AnyNode) {
		if (isTag(node) && isHashtagLink(node)) tags.add(hashtagOf(node));
		else if (isTag(node)) node.children.forEach(collect);
	});

	// Leading hashtag line.
	while (nodes.length && (isHashtagLink(nodes[0]) || isBlank(nodes[0]))) nodes.shift();

	// Trailing source URL: a bare link whose text is the URL.
	const trimEnd = () => {
		while (nodes.length && isBlank(nodes[nodes.length - 1])) nodes.pop();
	};
	trimEnd();
	let link: string | undefined;
	const last = nodes[nodes.length - 1];
	if (last && isTag(last) && last.name === 'a' && !isHashtagLink(last) && looksLikeUrl(textOf(last))) {
		const href = last.attribs.href;
		if (isSafeHref(href)) {
			link = href;
			nodes.pop();
			trimEnd();
		}
	}

	// Otherwise the last external link.
	if (!link) {
		const hrefs: string[] = [];
		nodes.forEach(function collect(node: AnyNode) {
			if (!isTag(node)) return;
			if (node.name === 'a' && /^https?:/i.test(node.attribs.href ?? '')) hrefs.push(node.attribs.href);
			node.children.forEach(collect);
		});
		link = hrefs.at(-1);
	}

	const html = serialize(nodes)
		.replace(/^(\s|<br>)+|(\s|<br>)+$/g, '')
		.replace(/(<br>\s*){3,}/g, '<br><br>');
	return { tags: [...tags], html, link };
}
