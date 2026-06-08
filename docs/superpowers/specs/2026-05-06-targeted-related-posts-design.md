# Targeted Related Posts — Design

**Date:** 2026-05-06
**Status:** Drafted, awaiting user review
**Branch:** `suggested-articles-improvements` (branched from `main`)

## Goal

Replace the bottom-of-article "You might also like..." widget's current "any shared tag" matching with content-relevance ranking from Typesense. Result: an interview about venture capital surfaces other VC content (events, posts, interviews) instead of "3 random recent interviews" — the current behavior whenever the post's only shared tags are routing tags like `hash-conversations`.

## Non-goals

-   Vector / embedding-based search (Typesense supports it but requires indexed vectors; the existing collection doesn't include them).
-   Live updates as the user scrolls or interacts with the article.
-   A/B testing alternate ranking weights.
-   Click tracking on related cards (analytics — separate concern).
-   "Similar by author" or "Similar by recency" — pure topic relevance only.
-   Increasing the number of related cards beyond 3 (the existing grid is `lg:grid-cols-3`).
-   Renaming `partials/related.hbs` (keep current path for git history).
-   Maintaining the Typesense → Ghost sync (out of scope; assumed operational).
-   Server-side stripping of `hash-*` routing tags from the SSR baseline filter (Ghost's template syntax doesn't compose strings cleanly enough; see Decisions table).

## Decisions and rationale

| Decision                     | Choice                                                                                                              | Rationale                                                                                                                                                                                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary ranker               | Typesense semantic similarity                                                                                       | Same Typesense instance as the search feature on the other branch. Content-based ranking is exactly "more targeted." No new infrastructure.                                                                                                                                                                                      |
| Fallback                     | Today's tag-match SSR (`tags:[{{post.tags}}]+id:-{{post.id}}`) used as a topup pool                                 | When Typesense returns < 3 hits or fails, the tag-matched cards already in DOM fill the gap. Same query path, single source of truth, doubles as no-JS baseline.                                                                                                                                                                 |
| Card count                   | 3                                                                                                                   | Matches existing `lg:grid-cols-3` layout. No row breakage.                                                                                                                                                                                                                                                                       |
| Topup behavior               | Render Typesense hits in order; top up with SSR cards skipped by Typesense (deduplicated by slug) until count = 3   | Always show 3 cards if any related content exists at all. Mixing sources is invisible — the "you might also like" label doesn't claim a specific algorithm.                                                                                                                                                                      |
| Collection scope             | Cross-collection (no Typesense `filter_by` on routing tags)                                                         | Matches existing widget behavior. "More targeted" is about content relevance, not file-cabinet purity. A VC event is genuinely a great suggestion on a VC interview.                                                                                                                                                             |
| Query construction           | `q = "<title>\n<excerpt>"` of current post                                                                          | Title alone is too narrow. Full body produces noisy BM25 ranking and inflates URL length. Excerpt is the post's hand-curated summary — the right signal density.                                                                                                                                                                 |
| Architecture                 | SSR baseline (existing `{{#get}}`) renders 3 tag-matched cards always; JS upgrades to Typesense ranking on init     | Progressive enhancement. No-JS users get the existing widget. JS users get the upgrade. Single rendering path through `partials/related.hbs`.                                                                                                                                                                                    |
| SSR fallback uses ALL tags   | Yes — including routing `hash-*` tags                                                                               | Ghost's template syntax doesn't expose a clean way to compose `tags:[…]` from a filtered subset of `{{post.tags}}` (no `concat` helper, no string-builder for filter expressions). The current widget's behavior is "good enough as a fallback" because Typesense provides the actual targeting; the SSR is just the safety net. |
| Card builder                 | JS template literal in `assets/js/related-posts.js` mirroring `partials/post-card.hbs` shape                        | Allows cross-collection Typesense hits not in the SSR pool. Maintenance cost: comments in both files cross-reference each other.                                                                                                                                                                                                 |
| AbortController              | Optional but used                                                                                                   | Not strictly needed (single fetch per page load), but consistent with the search wrapper pattern. Allows future "fire on filter change" without refactor.                                                                                                                                                                        |
| Failure UX                   | Silent — SSR cards stay; console warning only                                                                       | This is "you might also like," not core functionality. A red banner here would be UX overkill.                                                                                                                                                                                                                                   |
| Equal-set short-circuit      | If Typesense's top-3 slugs == SSR's slugs (any order), skip DOM swap                                                | Avoids visible re-layout flash for the common case where the SSR fallback was already correct.                                                                                                                                                                                                                                   |
| `@custom.show_related_posts` | Existing toggle preserved — `{{#if @custom.show_related_posts}}{{> related}}{{/if}}` in `post.hbs` remains the gate | Honors existing admin preference. Off → no widget, no JS, no Typesense call.                                                                                                                                                                                                                                                     |
| Empty-SSR case               | Always render the JS-enhanceable wrapper (even if SSR `{{#get}}` returns 0 cards) so JS can populate from Typesense | Without this, the rare post with no shared-tag matches would never get JS-enhanced even if Typesense has cross-collection hits.                                                                                                                                                                                                  |
| Query length cap             | `q.slice(0, 500)`                                                                                                   | Keeps URL under the 8KB practical browser URL cap with all other Typesense params.                                                                                                                                                                                                                                               |

## Architecture

```
post.hbs (article page)
   ↓
{{#if @custom.show_related_posts}}{{> related}}{{/if}}
   ↓
partials/related.hbs
   │
   └── <section class="related-wrapper"
                x-data="relatedPosts"
                data-post-id="{{post.id}}"
                data-post-title="{{post.title}}"
                data-post-excerpt="{{post.excerpt}}">
         <h3>You might also like…</h3>
         <div class="related-feed grid grid-cols-1 lg:grid-cols-3 ...">
            {{!-- SSR baseline: same {{#get}} block as today, always rendered.
                  Cards are the no-JS fallback AND the JS-side topup pool. --}}
            {{#get "posts" limit="3" filter="tags:[{{post.tags}}]+id:-{{post.id}}"
                  include="tags" as |related|}}
                {{#foreach related}}
                    {{> "post-card"}}
                {{/foreach}}
            {{/get}}
         </div>
       </section>

                                   ↓ Alpine init() in relatedPosts component

assets/js/related-posts.js
   │
   ├── Read source from $el.dataset (postId, postTitle, postExcerpt)
   ├── Read SSR cards from .related-feed [data-slug]
   ├── Call searchSimilar(`${title}\n${excerpt}`.slice(0,500), { excludeId, limit: 3 })
   │     │
   │     └── delegated to assets/js/typesense-search.js
   │
   ├── If response empty or fetch fails → no DOM mutation
   ├── If response slugs equal SSR slugs (any order) → no DOM mutation
   └── Otherwise → build hits as cards (or reuse SSR DOM where slugs match),
                    top up from SSR cards to reach 3, replace grid contents

assets/js/typesense-search.js
   │
   ├── existing `searchSlugs(query, tagSlugs, signal)` — unchanged
   └── new `searchSimilar(query, { excludeId, limit, signal })` — returns
        full hit objects (slug, title, excerpt, feature_image, url, tags,
        published_at) for client-side card rendering
```

## Files

| Path                            | Action                                           | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `partials/related.hbs`          | Modify                                           | Wrap existing content in `<section x-data="relatedPosts" data-post-id=… data-post-title=… data-post-excerpt=…>`. Always render the wrapper (move the `{{#if related}}` gate inside the foreach so the wrapper renders even with 0 SSR results). Source data goes on `data-*` attributes (Handlebars escaping handles HTML attribute encoding cleanly; a `<script type="application/json">` block would need custom JSON-safe escaping). |
| `partials/post-card.hbs`        | Modify (one line)                                | Add `data-slug="{{slug}}"` to `<article>` so JS can match SSR cards to Typesense hits by slug. (Same change as Feature 1; will collide trivially on merge.)                                                                                                                                                                                                                                                                             |
| `assets/js/related-posts.js`    | **New**                                          | Alpine component: orchestrate fetch, dedupe, swap. ~80 lines.                                                                                                                                                                                                                                                                                                                                                                           |
| `assets/js/typesense-search.js` | **New** (or extend if Feature 1 is merged first) | `searchSlugs` + `searchSimilar`. Three constants (host, key, collection) at top. Read from `window.__TYPESENSE_CONFIG__` with same defaults as fallback.                                                                                                                                                                                                                                                                                |
| `assets/js/main.js`             | Modify                                           | `import relatedPosts from './related-posts.js'; Alpine.data('relatedPosts', relatedPosts);` before `Alpine.start()`.                                                                                                                                                                                                                                                                                                                    |
| `default.hbs`                   | Modify                                           | Add `<script>window.__TYPESENSE_CONFIG__ = {...}</script>` injecting `{{@custom.typesense_*}}`. (Same block as Feature 1; will collide trivially on merge.)                                                                                                                                                                                                                                                                             |
| `package.json`                  | Modify                                           | Add `config.custom.typesense_host`, `typesense_api_key`, `typesense_collection`. (Same as Feature 1; will collide trivially on merge.)                                                                                                                                                                                                                                                                                                  |
| `README.md`                     | Modify                                           | Add the Typesense Search section. (Same as Feature 1; trivial conflict.)                                                                                                                                                                                                                                                                                                                                                                |

**Untouched:**

-   `post.hbs` — the `{{#if @custom.show_related_posts}}{{> related}}{{/if}}` block already does the right thing.
-   `assets/css/` — Tailwind utilities only, applied inline in the JS card builder.
-   `partials/post-filter-list.hbs` and any other listing partial — orthogonal.

## Data flow

State (per Alpine instance, one per article view):

```
source         : { id: string, title: string, excerpt: string }   // from $el.dataset
ssrCards       : Array<{ slug: string, el: HTMLElement }>        // from SSR DOM
typesenseHits  : Array<{ slug, title, excerpt, feature_image, url, primary_tag, published_at }> | null
                                                                  // null = fetch in progress or not started
```

Pipeline (one shot, on init):

```
init()
  ↓ source = { id: $el.dataset.postId, title: $el.dataset.postTitle, excerpt: $el.dataset.postExcerpt }
  ↓ ssrCards = grid.querySelectorAll('.feed-card[data-slug]')
  ↓ if (!source.title && !source.excerpt) return     // nothing to query with
  ↓
  fetch Typesense with q = (title + "\n" + excerpt).slice(0, 500)
                       filter_by = id:!=<source.id>
                       include_fields = slug,title,excerpt,feature_image,url,tags,published_at
                       per_page = 3
  ↓
  if fetch fails OR returns 0 hits:
      return       // SSR cards stay
  ↓
  if hits.slugs.sort() == ssrCards.slugs.sort():
      return       // identical set, skip DOM swap (no flash)
  ↓
  finalCards = []
  for hit in hits:
      ssr = ssrCards.find(c => c.slug === hit.slug)
      finalCards.push(ssr ? ssr.el : buildCardElement(hit))
  for ssr in ssrCards:
      if finalCards.length >= 3: break
      if !finalCards.includes(ssr.el): finalCards.push(ssr.el)
  ↓
  grid.replaceChildren(...finalCards)
```

## Card-building contract

`buildCardElement(hit)` produces DOM byte-equivalent to what `partials/post-card.hbs` emits, modulo:

-   No `data-tags` / `data-tag-names` (those are filter-page concerns; `related-posts.js` doesn't use them).
-   The `data-slug="{{slug}}"` IS preserved.
-   `data-title` and `data-published-at` from Feature 1 are NOT added (filter-page only).

Required Typesense fields per hit:

-   `slug` (string) — DOM identity / dedup
-   `title` (string) — heading
-   `excerpt` (string) — body copy (line-clamped to 4)
-   `feature_image` (string | null) — `<img>` src; if null, the `<img>` is omitted
-   `url` (string) — anchor href
-   `tags` (array of objects with `name`, `slug`, `url`) — first one becomes the primary-tag chip
-   `published_at` (number, Unix ms) — formatted client-side as `D MMM YYYY` to match `{{date format="D MMM YYYY"}}`

Verified against schema probe done earlier (collection `ghost`, 283 documents): all fields present.

**Cross-file maintenance:** comments in both `partials/post-card.hbs` and `assets/js/related-posts.js` point at each other. If either changes structure, the comment is the breadcrumb.

## Failure modes and edge cases

| Case                                                 | Behavior                                                                    |
| ---------------------------------------------------- | --------------------------------------------------------------------------- |
| Typesense unreachable / 5xx / malformed JSON         | Silent. SSR cards stay. `console.warn` for ops debugging.                   |
| AbortError (in-flight aborted by navigation)         | Silent. No DOM mutation.                                                    |
| Typesense returns 0 hits                             | SSR cards stay.                                                             |
| Typesense returns 1-2 hits                           | Render those, top up from SSR cards skipping duplicates.                    |
| Typesense returns the current post (despite filter)  | Defensive client-side filter: drop hits where `slug === source.slug`.       |
| Top-3 Typesense slugs == top-3 SSR slugs (any order) | No DOM mutation. Avoids re-layout flash.                                    |
| Empty SSR baseline (post has no tag overlap)         | Wrapper still rendered; JS populates if Typesense succeeds.                 |
| Post with no excerpt                                 | Query is just title. Acceptable.                                            |
| Long title + long excerpt                            | Query capped at 500 chars (`q.slice(0, 500)`).                              |
| `@custom.show_related_posts` = false                 | `post.hbs` doesn't include the partial. Zero work happens.                  |
| Missing `window.__TYPESENSE_CONFIG__`                | Wrapper falls back to in-file defaults. Same defaults as Feature 1.         |
| `feature_image` empty in Typesense response          | `<img>` element omitted (mirrors `{{#if feature_image}}` in post-card.hbs). |
| `tags` array empty                                   | Primary tag span shows "[No tag]" (mirrors `{{else}}` in post-card.hbs).    |

## Network traffic

-   **Per page load on a post:** one Typesense request (~500 bytes out, ~1-3 KB in for 3 hits with full fields). Plus one CORS preflight on first request from each origin. Total ~5 KB per article view.
-   **Per page load on a non-post (homepage, listings):** zero — `partials/related.hbs` only renders inside `{{#is "post"}}` in `post.hbs`.
-   Fits well within the spec acceptable budget; comparable to or lighter than the SSR widget's existing Ghost server-side `{{#get}}` cost (which it does not eliminate, but does add to).

## Accessibility

-   Existing `<h3>` heading preserved.
-   `<article>` with anchor inside — same keyboard-navigable structure as today.
-   No live region, no ARIA gymnastics — the section content is determined at page load and remains stable.
-   DOM swap on Typesense response happens before screen readers typically reach the related section, so re-announcement is rare. If it occurs, the heading is unchanged so context is preserved.
-   No focus management needed — user has not interacted with this section yet by the time JS runs.

## Testing and verification

No automated tests (theme has no test framework). Manual verification matrix:

1. Open any post with `@custom.show_related_posts` = true. Related section appears with 3 cards.
2. View page source: SSR cards present in HTML (no-JS baseline works).
3. Network panel: one Typesense request fires per page load.
4. Compare SSR cards (visible briefly) to final cards. If different, the swap should happen quickly and only once.
5. Pick a post with very specific topic (e.g., a VC interview). Related cards should now lean toward other VC content even from different collections.
6. Block `typesense.advisory.sg` in DevTools → reload. SSR cards stay, console warning logged, no error banner.
7. Disable JavaScript → reload. SSR cards still render; no JS-driven swap.
8. Toggle `@custom.show_related_posts` to false in Ghost Admin → reload post. Related section absent.
9. Test on a post where SSR returns 0 cards (rare). Related section present (empty wrapper); JS populates if Typesense has cross-collection hits.
10. Mobile viewport — cards stack into a single column (existing grid behavior, preserved).

## Future work (not part of this spec)

-   Vector embeddings + Typesense vector search for true semantic similarity (requires an indexer change).
-   Click-tracking analytics to measure whether targeted cards lift engagement.
-   Personalization (different related cards per reader based on history).
-   "More like this" pagination (load 3 more from Typesense on user request).
-   Server-side tag stripping if Ghost's template syntax ever gains a string-builder helper.
