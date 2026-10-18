# Kello

Kello is a static Astro site that mirrors the public Telegram channel [the_kello](https://t.me/s/the_kello) in English, with a Russian version at `/ru`. Posts are short notes on design, UI and tools: hashtags, one or two sentences of text, a source link and up to 10 images or videos.

The site is deployed on Vercel. A GitHub Actions job keeps the content in sync with the channel.

## How content gets in

```
t.me/s/the_kello ──► scripts/sync (GitHub Actions, every 12h + manual)
                         ├─ parse posts from the public web preview
                         ├─ download media, resize with sharp ──► public/media/<id>/
                         ├─ translate new or changed text (Google Translate, then Gemini)
                         └─ write src/data/posts/<id>.json, commit, push
                                        │
                                        ▼
                               Vercel rebuilds the site
```

- Telegram is the source of truth. A regular sync re-reads the last `channel.recentPages` pages, picks up edits and removes deleted posts. Passing `--full` makes it walk the whole history.
- Deletion only covers what the walk saw: on a regular sync, posts newer than the oldest one scanned; with `--full`, everything, including media folders without a post. If more than max(10, 20%) of posts seem to be gone, sync deletes nothing and warns (`--allow-mass-delete` overrides).
- On a regular sync the oldest post scanned is left untouched, because an album cut by the page boundary could look like a different post.
- Manual fixes go in an overrides file, never in the generated post JSON. Overrides can replace an English translation, hide a post or change its tags, and sync never writes to them.
- Translation runs only when the hash of the Russian text changes. Hashtags are never sent to the model; they map through the tag table in `kello.config.ts`.
- If a hashtag is missing from the config, the translator suggests an English slug, the post still publishes, and the sync commit message names the tag so it can be added to the config by hand. Suggested slugs are kept in `src/data/tag-suggestions.json` so they stay stable between runs.
- Translation providers are tried in the order of `translation.providers`; posts one provider can't translate go to the next, and a provider that fails outright never fails the sync.
  - `google` (`scripts/sync/google.ts`) calls the keyless endpoint behind the Google Translate widget, `translate_a/t?client=gtx&format=html`. It needs no account, so it works for a Russia-registered owner. Hrefs are swapped for indices before sending, and link text without Cyrillic (brand names, @mentions) plus `<code>` is marked `translate="no"`. Requests hold up to 4,000 characters and go out one per second. The whole archive is about 22,000 characters.
  - `gemini` runs only when `GEMINI_API_KEY` is set. It batches 15 posts per request, sends one request per 6.5 s for the free tier, and has thinking turned off.
- A translation that changes links or the tag sequence is rejected. If no provider manages a post, it keeps its previous English (or the Russian) and a stale `sourceHash`, so the next sync retries it.
- Media files are reused when the album item at the same position has the same message id and its files exist, so a re-sync only downloads what is new. A regular re-sync with nothing new takes a few seconds.

## Commands

```sh
npm run sync                     # last channel.recentPages pages
npm run sync -- --full           # whole channel, deletes anything no longer in it
npm run sync -- --no-translate   # no translation: English = Russian, no sourceHash, so a real sync translates later
npm run sync -- --message f.txt  # also write a commit message summary (used by the workflow)
npx astro sync                   # validate src/data/posts/*.json against the schema
```

The workflow `.github/workflows/sync.yml` runs `npm run sync` every 12 hours and on demand (with a `full` checkbox), then commits `src/data` and `public/media` if anything changed. It needs `contents: write`, which the workflow requests itself. The `GEMINI_API_KEY` repository secret is optional.

## Known limits

- The web preview at `t.me/s/` is undocumented HTML. Parse hashtags from `a[href^="?q="]` elements, not with a regex over text: a `<br>` between a tag and the next word disappears in `textContent`, which turns `#ui` and `Дамп` into `#uiДамп`.
- Media URLs on `telesco.pe` are signed and expire, so never link to them from the site. Everything is downloaded at sync time.
- Some videos have no source file in the preview (posts 213 and 227 as of Oct 2026). These, and any video over `media.maxVideoMB`, get type `unavailable` and link to the post in Telegram.
- The preview serves photos at 800px wide at most, so most images have a single `-800.webp` file holding the original. Raising `media.widths` adds nothing until a bigger source exists. Which widths exist follows from the original width: use `imageSources()` in `src/lib/media.ts` rather than assuming every configured width.
- Video thumbnails in the preview are tiny (≤320px). Sync takes the first frame with ffmpeg as the poster when ffmpeg is on `PATH` (the workflow installs it) and falls back to the thumbnail otherwise; a later run with ffmpeg replaces thumbnail posters. Video width and height come from the MP4 header.
- Service messages ("Channel created") are skipped, so the site has one post fewer than the channel's message count suggests.
- Text keeps `b`, `i`, `u`, `s`, `a`, `code`, `blockquote` and `br`. Custom emoji become their plain character, and hashtags outside the leading line become plain text.
- Albums use one message id per item, so post ids are not consecutive.
- The Google Translate endpoint is undocumented and keyless, so Google can rate-limit or close it without notice. Sync then warns, keeps the existing English, and hands posts to Gemini if a key is set.
- The Gemini API refuses requests from Russia and from Russia-registered Google accounts. Sync works from GitHub runners; running it locally needs a VPN.
- Media lives in git. Deleting a post does not shrink the repository history.

## Files

| Path | What it is |
| --- | --- |
| `kello.config.ts` | Channel, translation, media sizes and the tag table. Documented inline. |
| `src/lib/config.ts` | Zod schema and `defineConfig` for the config. |
| `src/content.config.ts` | Schema of a post JSON file. |
| `src/data/posts/*.json` | Generated by sync, one file per post. Do not edit by hand. |
| `src/data/overrides.ts` | Hand-written per-post fixes: `hidden`, `tags`, `text.en`. Sync never touches it. |
| `src/data/tag-suggestions.json` | Generated: slugs the translator suggested for hashtags missing from the config. Exists only when there are some. |
| `src/lib/posts.ts` | `getPosts()`: the posts collection with overrides applied, hidden posts dropped, newest first. Use it instead of `getCollection('posts')`. |
| `src/lib/media.ts` | `imageSources()`: which image files exist for a media entry, with real widths for `srcset`. |
| `scripts/sync/` | `npm run sync`: `scrape.ts` and `html.ts` parse the web preview, `media.ts` and `mp4.ts` download and resize, `tags.ts` maps hashtags, `translate.ts` has the provider chain and Gemini, `google.ts` the Google Translate provider, `store.ts` reads and writes post JSON, `index.ts` runs it all. |
| `.github/workflows/sync.yml` | Scheduled sync: every 12 hours and on demand. |
| `src/styles/variables.sass` | Design tokens as CSS custom properties. |
| `src/styles/*.sass` | Base, page, post, media row and viewer styles, all reading the tokens. |
| `src/components/Home.astro` | The page, shared by `/` and `/ru` through a `lang` prop. |
| `src/lib/i18n.ts` | The UI string dictionary. |
| `src/lib/feed.ts` | `getFeed()`: the posts the page renders. |
| `src/lib/urls.ts` | Media, `srcset` and Telegram URLs, and the source link domain. |
| `src/scripts/` | Client scripts: tag filter, media row (chevrons, video autoplay), media viewer, and `url.ts` for the shared query string. |
| `public/media/` | Generated images (AVIF and WebP at each configured width) and videos. |

## Design

The page has three parts: the heading "Kello", a line of tag filters, then posts. Nothing else goes in the header or footer, except the language link (`ru` on `/`, `en` on `/ru`).

- Swiss style: Inter, a flush-left asymmetric grid, generous whitespace and loose vertical rhythm between posts. The one accent colour is `#3733d2`, lightened to `#8582ff` in dark mode. It marks focus rings and link hover, and appears nowhere else. Selected tags turn `--primary`.
- Inter is loaded with its optical-size axis (`@fontsource-variable/inter/opsz.css`). Body text gets the text cut automatically, and the heading is pinned to the Display cut with `--opsz-display` (32). The preloaded font file must be the `opsz` one too.
- Tags, their labels, the heading and UI words (telegram, close, watch in telegram) are lowercase; the config schema rejects uppercase labels.
- One text size, `--text-base`, for everything except the heading. The page starts `--page-padding-top` (12rem) down.
- Post text is typeset at build time (`src/lib/typography.ts`, applied in `getPosts()`). A hyphen or en dash between spaces becomes an em dash. Emoji from Telegram stay.
- Secondary and tertiary greys are deliberately faint (`#b8b8b8` and `#e2e2e2` on light). That's below WCAG text contrast, which is accepted for the quiet parts: unselected tags, the Telegram link and the language link.
- Colour scheme follows `prefers-color-scheme`. Every colour comes from a token, so dark mode only redefines the tokens.
- From 64rem up, the page spans the window with at least 4rem (`--page-padding-wide`) of padding on each side, and the feed scatters (`src/scripts/inline/feed.js`). That script is plain JS inlined right after the feed, so it runs while the page parses. A `data-js` flag set in `<head>` keeps the wide feed hidden until the script has placed it, so the single column never flashes. If the script throws, it drops the flag and the column shows.
  - Posts become narrow columns, `--scatter-span` of `--scatter-columns` grid columns wide, with tags in a row and body-size text.
  - The tag line uses the same grid. It runs from the column after `--index-columns` to the right edge of the page, so it starts where posts can start.
  - Each post goes in a start column picked by a hash of its id, from the columns that let it sit within `--scatter-jitter` of the highest free spot. It then drops by a further hashed amount up to `--scatter-jitter`. So posts share vertical space without touching, and positions stay stable between visits.
  - No post sits above the one before it, so the feed still reads newest first, top to bottom.
  - The layout re-runs on filter, resize and font load. The Inter file for the page's language is preloaded, so the first layout usually has the right metrics. Without JS, and below 64rem, the feed is a single centred column.
- Media loading state: an image slot shows its image as an ordered dither (fine dots) until the image arrives.
  - The source is a 16px-wide preview made at build time (`src/lib/preview.ts`, about 100 bytes of inline WebP).
  - In CSS (`media.sass`), the preview is scaled up smoothly, greyed and halved in brightness, and a 4×4 Bayer threshold map at half strength is added with `mix-blend-mode: plus-lighter`. `contrast(64)` then turns each point black or white, which is an ordered dither of the image.
  - The threshold map steps through offsets in a loop, so the dots crawl. The loop is ambient and never delays the image: the image's `load` event clears `data-loading`, and the image steps in over `--duration-base`. Images already in the cache are cleared before the first paint.
  - Without JS, nothing is hidden. Videos show their poster with no dither. Tune with the `--dither-*` tokens.
- Selected tags combine with AND. Once a tag is selected, any tag that would leave zero posts is dimmed and can't be clicked. The selection is stored in the URL as `?tags=ui,code`.
- The media row: a single item spans the full container width. With more than one, the first item takes 80% of the width, followed by a 0.5rem gap and the rest, all in one horizontally scrolling row at a fixed ratio with `object-fit: cover`. On hover, previous and next chevrons appear; on touch screens the row swipes with scroll snapping.
- Clicking an item opens a `<dialog>`. It shows the post's whole row as a carousel the full width of the dialog, with the clicked item centred, and the post's text, tags and links below.
  - Each item is uncropped at its own ratio. Its width is the smallest of `--viewer-media-height` × ratio, `--viewer-media-max` (64rem) and the dialog width minus gutters; the height follows from the ratio.
  - Clicking the current item's left or right half moves to the previous or next item, as do the arrow keys and swipes. Clicking a neighbour goes to it. Esc, the close button, or a click anywhere outside the media and the post's text block (the top bar, the gaps, the margins) closes the dialog. While a mouse is over such a spot, the close button shows its hover state.
  - While it's open, the URL carries `?post=<id>` and, from the second item on, `&media=<n>`. Loading such a link opens the viewer there. `src/scripts/url.ts` owns the query string for both the filter and the viewer.
- Videos play muted and looped while they are in view and pause when they leave it. With `prefers-reduced-motion`, they show the poster instead.
- Post meta: the source link is shown as its domain (`psiquantum.com ↗`) and is the primary link. The Telegram link is quieter. Both are styled as text links, not buttons.
- No uppercase labels, eyebrows, counters, decorative dividers or rounded cards.
- Grid: 12 columns from 48rem up. Post tags take the first `--index-columns`; the filter line and post text start after them. Below 48rem everything stacks.
- Tags no post uses are left out of the filter line.

Tokens added with the UI, beyond the ones above: `--font-mono`, `--text-code`, `--display-indent` (optical correction for the heading), `--underline-width`, `--underline-offset`, `--index-columns`, `--media-nav-size` (chevron square), `--viewer-media-height`, `--viewer-media-max`, `--focus-width`, `--focus-offset`. The 48rem breakpoint and the `sizes` attributes in `MediaRow.astro` are written out, since media queries and HTML can't read custom properties.

Image and poster URLs go through `imageSet()` in `src/lib/urls.ts`, which builds `srcset` from `imageSources()` so only files that exist are referenced.

## Conventions

- Styles are written in indented `.sass` syntax, using CSS features only: no Sass variables, mixins, `@extend` or functions. Read values from the tokens in `variables.sass` instead of hard-coding them.
- Tabs for indentation in TS and Astro files, two spaces in `.sass`.
- UI strings are English on `/` and Russian on `/ru`. There are only a handful, kept in one dictionary.
- Before finishing a change, run `npm run build`. It type-checks the content collection against the schema.
