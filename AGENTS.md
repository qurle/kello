# Kello

Kello is a static Astro site that mirrors the public Telegram channel [the_kello](https://t.me/s/the_kello) in English, with a Russian version at `/ru`. Posts are short notes on design, UI and tools: hashtags, one or two sentences of text, a source link and up to 10 images or videos.

The site is deployed on Vercel. A GitHub Actions job keeps the content in sync with the channel.

## How content gets in

```
t.me/s/the_kello ──► scripts/sync (GitHub Actions, every 12h + manual)
                         ├─ parse posts from the public web preview
                         ├─ download media, resize with sharp ──► public/media/<id>/
                         ├─ translate new or changed text (Google Translate)
                         └─ write src/data/posts/<id>.json, commit, push
                                        │
                                        ▼
                               Vercel rebuilds the site
```

- Telegram is the source of truth. A regular sync re-reads the last `channel.recentPages` pages, picks up edits and removes deleted posts. Passing `--full` makes it walk the whole history.
- Deletion only covers what the walk saw: on a regular sync, posts newer than the oldest one scanned; with `--full`, everything, including media folders without a post. If more than max(10, 20%) of posts seem to be gone, sync deletes nothing and warns (`--allow-mass-delete` overrides).
- On a regular sync the oldest post scanned is left untouched, because an album cut by the page boundary could look like a different post.
- Manual fixes go in an overrides file, never in the generated post JSON. Overrides can replace an English translation, hide a post or change its tags, and sync never writes to them.
- Translation runs only when the hash of the Russian text changes. Hashtags are never sent to the translator; they map through the tag table in `kello.config.ts`.
- If a hashtag is missing from the config, the translator suggests an English slug, the post still publishes, and the sync commit message names the tag so it can be added to the config by hand. Suggested slugs are kept in `src/data/tag-suggestions.json` so they stay stable between runs.
- Translation goes through a small `Translator` interface (`scripts/sync/translate.ts`), so another provider can be added later. A translator that fails outright never fails the sync.
  - The one provider today, `GoogleTranslator` (`scripts/sync/google.ts`), calls the keyless endpoint behind the Google Translate widget, `translate_a/t?client=gtx&format=html`. It needs no account, so it works for a Russia-registered owner. Hrefs are swapped for indices before sending, and link text without Cyrillic (brand names, @mentions) plus `<code>` is marked `translate="no"`. Requests hold up to 4,000 characters and go out one per second. The whole archive is about 22,000 characters.
- A translation that changes links or the tag sequence is rejected. If translation fails for a post, it keeps its previous English (or the Russian) and a stale `sourceHash`, so the next sync retries it.
- Media files are reused when the album item at the same position has the same message id and its files exist, so a re-sync only downloads what is new. A regular re-sync with nothing new takes a few seconds.

## Commands

```sh
npm run sync                     # last channel.recentPages pages
npm run sync -- --full           # whole channel, deletes anything no longer in it
npm run sync -- --no-translate   # no translation: English = Russian, no sourceHash, so a real sync translates later
npm run sync -- --message f.txt  # also write a commit message summary (used by the workflow)
npm run check-bot                # check the full-size photo bot (see Full-size photos)
npx astro sync                   # validate src/data/posts/*.json against the schema
```

The workflow `.github/workflows/sync.yml` runs `npm run sync` every 12 hours and on demand (with a `full` checkbox), then commits `src/data` and `public/media` if anything changed. It needs `contents: write`, which the workflow requests itself.

## Full-size photos

Telegram keeps photos at up to 1280px, or 2560px when sent in HD, but its public pages only serve the 800px copy. When a bot is set up, sync fetches the largest copy through the Bot API (`scripts/sync/bot.ts`).

Bots can't read a channel's history, so each photo's message is forwarded from the channel into a private scratch chat. The largest size is downloaded from the forward, and the forward is deleted.

- **New photos** come through the bot first, falling back to the preview.
- **Existing 800px photos** are upgraded once and marked `full: true` in their post JSON, so later syncs skip them. A regular sync only covers the recent pages; old posts are upgraded by a `--full` run.
- **Videos the preview doesn't serve** are fetched through the bot if they're under 20 MB and `media.maxVideoMB`.
- **Pace:** forwards go out one every ~3s to stay under Telegram's per-chat limit, so a full backfill of ~300 photos takes about 20 minutes.
- **Failures:** any failure falls back to the preview copy. After 3 failures in a row, the bot is dropped for the rest of the run.

Setup, once:

1. Create a bot with @BotFather and keep its token.
2. Add the bot to the channel as an admin. It needs no particular rights.
3. Create a private channel as the scratch chat and add the bot there as an admin too. It posts and deletes the forwards there.
4. Find the scratch chat's id, which starts with `-100`. Either open the chat at `web.telegram.org/a/` and read the id after `#`, or post in the chat and read `chat.id` from `https://api.telegram.org/bot<token>/getUpdates`.
5. Add the repository secrets `TELEGRAM_BOT_TOKEN` and `TELEGRAM_DUMP_CHAT_ID`. The names come from `channel.bot` in `kello.config.ts`.
6. Check it locally: put both variables in `.env` (gitignored; the sync and `check-bot` load it) and run `npm run check-bot`. It fetches one photo and prints its full size.
7. Run the sync workflow once with **full** ticked to upgrade every existing photo.

## Known limits

- The web preview at `t.me/s/` is undocumented HTML. Parse hashtags from `a[href^="?q="]` elements, not with a regex over text: a `<br>` between a tag and the next word disappears in `textContent`, which turns `#ui` and `Дамп` into `#uiДамп`.
- Media URLs on `telesco.pe` are signed and expire, so never link to them from the site. Everything is downloaded at sync time.
- Some videos have no source file in the preview (posts 213 and 227 as of Oct 2026). These, and any video over `media.maxVideoMB`, get type `unavailable` and link to the post in Telegram.
- The preview serves photos at 800px wide at most. Without the bot (below), most images have a single `-800.webp` file holding that copy. Which widths exist follows from the original width: use `imageSources()` in `src/lib/media.ts` rather than assuming every configured width.
- Video thumbnails in the preview are tiny (≤320px). Sync takes the first frame with ffmpeg as the poster when ffmpeg is on `PATH` (the workflow installs it) and falls back to the thumbnail otherwise; Video width and height come from the MP4 header.
- Service messages ("Channel created") are skipped, so the site has one post fewer than the channel's message count suggests.
- Text keeps `b`, `i`, `u`, `s`, `a`, `code`, `blockquote` and `br`. Custom emoji become their plain character, and hashtags outside the leading line become plain text.
- Albums use one message id per item, so post ids are not consecutive.
- The Google Translate endpoint is undocumented and keyless, so Google can rate-limit or close it without notice. Sync then warns, keeps the existing English, and retries on the next run.
- Media lives in git. Deleting a post does not shrink the repository history.

## Files

| Path | What it is |
| --- | --- |
| `kello.config.ts` | Channel, media sizes and the tag table. Documented inline. |
| `src/lib/config.ts` | Zod schema and `defineConfig` for the config. |
| `src/content.config.ts` | Schema of a post JSON file. |
| `src/data/posts/*.json` | Generated by sync, one file per post. Do not edit by hand. |
| `src/data/overrides.ts` | Hand-written per-post fixes: `hidden`, `tags`, `text.en`. Sync never touches it. |
| `src/data/tag-suggestions.json` | Generated: slugs the translator suggested for hashtags missing from the config. Exists only when there are some. |
| `src/lib/posts.ts` | `getPosts()`: the posts collection with overrides applied, hidden posts dropped, newest first. Use it instead of `getCollection('posts')`. |
| `src/lib/media.ts` | `imageSources()`: which image files exist for a media entry, with real widths for `srcset`. |
| `scripts/sync/` | `npm run sync`: `scrape.ts` and `html.ts` parse the web preview, `media.ts` and `mp4.ts` download and resize, `tags.ts` maps hashtags, `translate.ts` has the `Translator` interface and the markup check, `google.ts` the Google Translate provider, `bot.ts` fetches full-size media, `store.ts` reads and writes post JSON, `types.ts` has the shared shapes, `env.ts` loads `.env`, `index.ts` runs it all. |
| `scripts/check-bot.ts` | `npm run check-bot`. |
| `.github/workflows/sync.yml` | Scheduled sync: every 12 hours and on demand. |
| `src/styles/variables.sass` | Design tokens as CSS custom properties. |
| `src/styles/fonts.sass` | `@font-face` rule for the heading font. |
| `src/assets/fonts/` | The Mustica Pro heading subset. |
| `src/styles/base.sass` | Reset, element defaults and the `.tag` button shared by the filter line and posts. Everything else is styled in its component. |
| `src/components/` | `Home.astro` is the page, shared by `/` and `/ru` through `lang` and `page` props; it renders `Post.astro`, which renders `MediaRow.astro` and `Picture.astro`, and `Viewer.astro`, the media dialog. Each holds its own styles. |
| `src/pages/` | `index.astro` and `ru/index.astro` are the first page; `page/[page].astro` and `ru/page/[page].astro` the rest. |
| `src/lib/pages.ts` | Feed pages: which posts are on a page, and page paths. |
| `src/lib/i18n.ts` | The UI string dictionary. |
| `src/lib/hash.ts` | `hash()`: a stable integer from a post id. Post.astro writes it to `data-hash` for the feed scatter, and uses it to pick the settle direction. |
| `src/lib/preview.ts` | Build-time 16px previews for the loading dither. |
| `src/lib/tags.ts` | Tag labels, order and the filter line's tags. |
| `src/lib/urls.ts` | Media, `srcset` and Telegram URLs, and the source link domain. |
| `src/scripts/` | Client scripts: tag filter, media row (chevrons, video autoplay), media viewer, `pages.ts` for loading the other feed pages, and `url.ts` for the shared query string. `inline/feed.js` is the exception, inlined in Home.astro: scattered feed and loading state. |
| `public/media/` | Generated images (WebP, or AVIF too if `media.formats` lists it, at each stored width) and videos. |

## Design

The page has three parts: the heading "Kello", a line of tag filters, then posts. Nothing else goes in the header or footer, except the language link (`ru` on `/`, `en` on `/ru`, to the same page number) and the "more" link to the next page after the feed.

- Swiss style: Inter for text, a flush-left asymmetric grid, generous whitespace and loose vertical rhythm between posts. The one accent colour is `#3733d2`, lightened to `#8582ff` in dark mode. It marks focus rings and link hover, and appears nowhere else. Selected tags turn `--primary`.
- Fonts are self-hosted: Vite copies them into `/_astro/` at build time, and nothing loads from another host.
  - Inter sets all text through `--font-sans`. It comes from the `@fontsource-variable/inter` package (`wght.css`: variable weight, no optical-size axis), whose `unicode-range` subsets mean a page downloads only the Latin and, on `/ru`, Cyrillic files.
  - The heading "kello" is Mustica Pro SemiBold through `--font-display`, used nowhere else. Its file is in `src/assets/fonts` with an `@font-face` rule in `src/styles/fonts.sass`. It is a WOFF2 subset of the owner's OTF (basic Latin, Latin-1 punctuation, general punctuation, basic Cyrillic; about 28 KB) made with `pyftsubset`, keeping only the `kern`, `liga` and `case` features. To change the character set, re-run `pyftsubset` on the OTF, which is not in the repo.
  - `Home.astro` preloads Mustica Pro on both pages, plus the Inter file for the page's language (Latin on `/`, Cyrillic on `/ru`).
- Tags, their labels, the heading and every UI string in `src/lib/i18n.ts` are lowercase; the config schema rejects uppercase labels.
- One text size, `--text-base`, for everything except the heading. The page starts `--page-padding-top` (12rem) down.
- Post text is typeset at build time (`src/lib/typography.ts`, applied in `getPosts()`). A hyphen or en dash between spaces becomes an em dash. Emoji from Telegram stay.
- Secondary and tertiary greys are deliberately faint (`#b8b8b8` and `#e2e2e2` on light). That's below WCAG text contrast, which is accepted for the quiet parts: unselected tags, the Telegram link and the language link.
- Colour scheme follows `prefers-color-scheme`. Every colour comes from a token, so dark mode only redefines the tokens.
- From 64rem up, the page spans the window with at least 4rem (`--page-padding-wide`) of padding on each side, and the feed scatters (`src/scripts/inline/feed.js`). That script is plain JS inlined right after the feed, so it runs while the page parses. A `data-js` flag set in `<head>` keeps the wide feed hidden until the script has placed it, so the single column never flashes. If the script throws, it drops the flag and the column shows.
  - Posts become narrow columns, `--scatter-span` of `--scatter-columns` grid columns wide, with tags in a row and body-size text.
  - The tag line uses the same grid. It runs from the column after `--index-columns` to the right edge of the page, so it starts where posts can start.
  - Each post goes in a start column picked by a hash of its id (`data-hash`), from the columns that let it sit within `--scatter-jitter` of the highest free spot. It then drops by a further hashed amount up to `--scatter-jitter`. So posts share vertical space without touching, and positions stay stable between visits.
  - No post sits above the one before it, so the feed still reads newest first, top to bottom.
  - The layout re-runs on filter, resize, font load and when another page's posts come in. The heading font and the Inter file for the page's language are preloaded, so the first layout usually has the right metrics. Without JS, and below 64rem, the feed is a single centred column.
- Media loading state: an image slot shows its image, and a video slot its poster, as an ordered dither (fine dots) until it arrives.
  - The source is a 16px-wide preview made at build time (`src/lib/preview.ts`, about 100 bytes of inline WebP).
  - In CSS (`MediaRow.astro`), the preview is scaled up smoothly, greyed and halved in brightness, and a 4×4 Bayer threshold map at half strength is added with `mix-blend-mode: plus-lighter`. `contrast(64)` then turns each point black or white, which is an ordered dither of the image.
  - The threshold map steps through offsets in a loop, so the dots crawl. The loop is ambient and never delays the image: the image's `load` event clears `data-loading`, and the image steps in over `--duration-base`. Images already in the cache are cleared before the first paint.
  - Without JS, nothing is hidden. Tune with the `--dither-*` tokens.
- The feed comes in pages of `site.pageSize` posts (24): `/`, `/page/2/`… and `/ru`, `/ru/page/2/`…, all static.
  - Each page's HTML holds only its own posts, which keeps the first load to about 24 posts' worth of DOM and images. The filter line still lists every tag.
  - With JS, `src/scripts/pages.ts` fetches the next page's HTML once the "more" link is two windows away, and puts its posts at the end of the feed. Without JS the link goes to the next page.
  - Picking a tag, or opening a `?tags=` or `?post=` link, first loads every page, so the filter and the viewer see the whole feed. A `?tags=` link keeps the feed hidden until then (`data-filtering`).
  - Posts from another page announce themselves with a `kello:posts` event; `feed.js`, the filter and the media rows set them up on it.
- Selected tags combine with AND. Once a tag is selected, any tag that would leave zero posts is dimmed and can't be clicked. The selection is stored in the URL as `?tags=ui,code`.
- The media row: a single item spans the full container width. With more than one, the first item takes 80% of the width, followed by a 0.5rem gap and the rest, all in one horizontally scrolling row at a fixed 16:9 (`--media-ratio`) with `object-fit: cover`. On hover, previous and next chevrons appear; on touch screens the row swipes with scroll snapping.
- Feed media sit under a flat tint so they separate from the background: `--media-tint` (#f7f7f7) with `darken` on light, which caps white at the tint, and #191919 with `lighten` on dark. It is a `::after` on each slot, so the viewer, which copies only the picture or video, shows media untinted.
- Clicking an item opens a `<dialog>`. It shows the post's whole row as a carousel the full width of the dialog, with the clicked item centred, and the post's text, tags and links below.
  - Each item is uncropped at its own ratio. Its width is the smallest of `--viewer-media-height` × ratio, `--viewer-media-max` (64rem) and the dialog width minus gutters; the height follows from the ratio.
  - Clicking the current item's left or right half moves to the previous or next item, as do the arrow keys and swipes. Clicking a neighbour goes to it. Esc, the close button, or a click anywhere outside the media and the post's text block (the top bar, the gaps, the margins) closes the dialog. While a mouse is over such a spot, the close button shows its hover state.
  - While it's open, the URL carries `?post=<id>` and, from the second item on, `&media=<n>`. Loading such a link opens the viewer there. `src/scripts/url.ts` owns the query string for both the filter and the viewer.
- Videos play muted and looped while they are in view and pause when they leave it. With `prefers-reduced-motion`, they show the poster instead. In the feed the poster is a lazy `<picture>` under the video, not its `poster` attribute, which would load every poster at once and at one size; the viewer copies it into `poster`.
- Image `sizes` follow the layout: a third of the window less the page padding from 64rem, 40rem in the single column.
- Posts settle as they come in (`Post.astro`): a post enters at the bottom of the window tilted by `--settle-angle` (2.5deg), clockwise or counter-clockwise by a hash of its id (`--settle-direction`, set in `Post.astro`), and straightens over the first `--settle-distance` (40vh) of scrolling with `--settle-ease`.
  - It is a scroll-driven animation (`animation-timeline: view()`), so the angle follows the scroll position, both ways, with no script. Browsers without scroll-driven animations (Firefox for now) show posts straight.
  - Only the `rotate` property changes, so it composites and never touches the `inset` and `width` that `feed.js` sets. It works the same in the scattered feed and the single column.
  - With `prefers-reduced-motion`, nothing tilts.
- Post meta: the source link is shown as its domain (`psiquantum.com ↗`) and is the primary link. The Telegram link is quieter. Both are styled as text links, not buttons.
- No uppercase labels, eyebrows, counters, decorative dividers or rounded cards.
- Grid: 12 columns from 48rem up. Post tags take the first `--index-columns`; the filter line and post text start after them. Below 48rem everything stacks.
- Tags no post uses are left out of the filter line.

Tokens added with the UI, beyond the ones above: `--font-mono`, `--text-code`, `--display-indent` (optical correction for the heading), `--underline-width`, `--underline-offset`, `--index-columns`, `--media-nav-size` (chevron square), `--media-tint`, `--media-tint-blend`, `--viewer-media-height`, `--viewer-media-max`, `--focus-width`, `--focus-offset`, `--ease-out`, `--settle-angle`, `--settle-distance`, `--settle-ease`. The 48rem breakpoint and the `sizes` attributes in `MediaRow.astro` are written out, since media queries and HTML can't read custom properties.

Image and poster URLs go through `imageSet()` in `src/lib/urls.ts`, which builds `srcset` from `imageSources()` so only files that exist are referenced.

## Conventions

- Styles are written in indented Sass syntax, using CSS features only: no Sass variables, mixins, `@extend` or functions. Nesting is fine; it is CSS now too. Read values from the tokens in `variables.sass` instead of hard-coding them.
- A component's styles live in its own `<style lang="sass">` block, which Astro scopes to that component. So class names are short and plain (`.meta`, `.title`, `.track`), nested by indentation; no BEM (`block__element--modifier`). A variant is a second class (`.nav.prev`) or a data attribute.
  - Scoped styles don't reach markup the component doesn't render itself: Telegram's HTML set with `set:html`, `Picture.astro`'s elements inside `MediaRow`, the copies `viewer.ts` puts in the dialog, and state on `<html>` (`data-js`, `data-filtering`). Wrap those selectors in `:global()`.
  - Only tokens, fonts and `base.sass` are global, imported in `Home.astro`.
  - Scripts find elements by `data-*` attributes, never by class.
- Tabs for indentation in TS and Astro markup, four spaces in Sass (in `.sass` files and `<style lang="sass">` blocks, whose rules start at column 0).
- UI strings are English on `/` and Russian on `/ru`. There are only a handful, kept in one dictionary.
- Before finishing a change, run `npm run build`, which type-checks the content collection against the schema, and `npx tsc --noEmit`. `tsconfig.json` extends Astro's base with `strictNullChecks` on, which Zod's types need; the rest of `strict` stays off.
