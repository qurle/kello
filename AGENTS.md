# Kello

Kello is a static Astro site that mirrors the public Telegram channel [the_kello](https://t.me/s/the_kello) in English, with a Russian version at `/ru`. Posts are short notes on design, UI and tools: hashtags, one or two sentences of text, a source link and up to 10 images or videos.

The site is deployed on Vercel. A GitHub Actions job keeps the content in sync with the channel.

## How content gets in

```
t.me/s/the_kello ──► scripts/sync (GitHub Actions, every 12h + manual)
                         ├─ parse posts from the public web preview
                         ├─ download media, resize with sharp ──► public/media/<id>/
                         ├─ translate new or changed text with Gemini
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
- If a hashtag is missing from the config, Gemini suggests an English slug, the post still publishes, and the sync commit message names the tag so it can be added to the config by hand. Suggested slugs are kept in `src/data/tag-suggestions.json` so they stay stable between runs.
- Translations are batched (15 posts per request, one request per 6.5 s for the free tier). A translation that changes links or the tag sequence is rejected; the post keeps its previous English (or the Russian) and a stale `sourceHash`, so the next sync retries it.
- Media files are reused when the album item at the same position has the same message id and its files exist, so a re-sync only downloads what is new. A regular re-sync with nothing new takes a few seconds.

## Commands

```sh
npm run sync                     # last channel.recentPages pages; needs GEMINI_API_KEY
npm run sync -- --full           # whole channel, deletes anything no longer in it
npm run sync -- --no-translate   # no Gemini: English = Russian, no sourceHash, so a real sync translates later
npm run sync -- --message f.txt  # also write a commit message summary (used by the workflow)
npx astro sync                   # validate src/data/posts/*.json against the schema
```

The workflow `.github/workflows/sync.yml` runs `npm run sync` every 12 hours and on demand (with a `full` checkbox), then commits `src/data` and `public/media` if anything changed. It needs the `GEMINI_API_KEY` repository secret and `contents: write`, which the workflow requests itself.

## Known limits

- The web preview at `t.me/s/` is undocumented HTML. Parse hashtags from `a[href^="?q="]` elements, not with a regex over text: a `<br>` between a tag and the next word disappears in `textContent`, which turns `#ui` and `Дамп` into `#uiДамп`.
- Media URLs on `telesco.pe` are signed and expire, so never link to them from the site. Everything is downloaded at sync time.
- Some videos have no source file in the preview (posts 213 and 227 as of Oct 2026). These, and any video over `media.maxVideoMB`, get type `unavailable` and link to the post in Telegram.
- The preview serves photos at 800px wide at most, so most images have a single `-960` file holding the 800px original. Which widths exist follows from the original width: use `imageSources()` in `src/lib/media.ts` rather than assuming every configured width.
- Video thumbnails in the preview are tiny (≤320px). Sync takes the first frame with ffmpeg as the poster when ffmpeg is on `PATH` (the workflow installs it) and falls back to the thumbnail otherwise; a later run with ffmpeg replaces thumbnail posters. Video width and height come from the MP4 header.
- Service messages ("Channel created") are skipped, so the site has one post fewer than the channel's message count suggests.
- Text keeps `b`, `i`, `u`, `s`, `a`, `code`, `blockquote` and `br`. Custom emoji become their plain character, and hashtags outside the leading line become plain text.
- Albums use one message id per item, so post ids are not consecutive.
- The Gemini API refuses requests from Russia. Sync works from GitHub runners; running it locally needs a VPN.
- Media lives in git. Deleting a post does not shrink the repository history.

## Files

| Path | What it is |
| --- | --- |
| `kello.config.ts` | Channel, translation, media sizes and the tag table. Documented inline. |
| `src/lib/config.ts` | Zod schema and `defineConfig` for the config. |
| `src/content.config.ts` | Schema of a post JSON file. |
| `src/data/posts/*.json` | Generated by sync, one file per post. Do not edit by hand. |
| `src/data/overrides.ts` | Hand-written per-post fixes: `hidden`, `tags`, `text.en`. Sync never touches it. |
| `src/data/tag-suggestions.json` | Generated: slugs Gemini suggested for hashtags missing from the config. Exists only when there are some. |
| `src/lib/posts.ts` | `getPosts()`: the posts collection with overrides applied, hidden posts dropped, newest first. Use it instead of `getCollection('posts')`. |
| `src/lib/media.ts` | `imageSources()`: which image files exist for a media entry, with real widths for `srcset`. |
| `scripts/sync/` | `npm run sync`: `scrape.ts` and `html.ts` parse the web preview, `media.ts` and `mp4.ts` download and resize, `tags.ts` maps hashtags, `translate.ts` is the Gemini provider, `store.ts` reads and writes post JSON, `index.ts` runs it all. |
| `.github/workflows/sync.yml` | Scheduled sync: every 12 hours and on demand. |
| `src/styles/variables.sass` | Design tokens as CSS custom properties. |
| `public/media/` | Generated images (AVIF and WebP at each configured width) and videos. |

## Design

The page has three parts: the heading "Kello", a line of tag filters, then posts. Nothing else goes in the header or footer, except the language link (`ru` on `/`, `en` on `/ru`).

- Swiss style: Inter, a flush-left asymmetric grid, generous whitespace and loose vertical rhythm between posts. The one accent colour is `#3733d2`, lightened to `#8582ff` in dark mode. It marks selected tags, focus rings and link hover, and appears nowhere else.
- Colour scheme follows `prefers-color-scheme`. Every colour comes from a token, so dark mode only redefines the tokens.
- Selected tags combine with AND. Once a tag is selected, any tag that would leave zero posts is dimmed and can't be clicked. The selection is stored in the URL as `?tags=ui,code`.
- The media row: a single item spans the full container width. With more than one, the first item takes 80% of the width, followed by a 0.5rem gap and the rest, all in one horizontally scrolling row at a fixed ratio with `object-fit: cover`. On hover, previous and next chevrons appear; on touch screens the row swipes with scroll snapping.
- Clicking an item opens it in a `<dialog>` showing the media uncropped, plus the post's text, tags and links. Clicking the left or right half moves to the previous or next item, the arrow keys do the same, and Esc closes the dialog.
- Videos play muted and looped while they are in view and pause when they leave it. With `prefers-reduced-motion`, they show the poster instead.
- Post meta: the source link is shown as its domain (`psiquantum.com ↗`) and is the primary link. The Telegram link is quieter. Both are styled as text links, not buttons.
- No uppercase labels, eyebrows, counters, decorative dividers or rounded cards.

## Conventions

- Styles are written in indented `.sass` syntax, using CSS features only: no Sass variables, mixins, `@extend` or functions. Read values from the tokens in `variables.sass` instead of hard-coding them.
- Tabs for indentation in TS and Astro files, two spaces in `.sass`.
- UI strings are English on `/` and Russian on `/ru`. There are only a handful, kept in one dictionary.
- Before finishing a change, run `npm run build`. It type-checks the content collection against the schema.
