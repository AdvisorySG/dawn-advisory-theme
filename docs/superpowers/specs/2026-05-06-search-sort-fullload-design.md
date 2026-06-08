# Search, Sort, and Full-corpus Load — Design

**Date:** 2026-05-06
**Status:** Drafted, awaiting user review
**Related:** `2026-05-06-sort-filter-design.md` (the prior shipped feature this extends)

## Goal

Extend the existing tag-filter UI on `/events/` and `/interviews/` with three additions:

1. **Search** — a live, typo-tolerant text search across the full post corpus, backed by Typesense.
2. **Sort** — a dropdown letting readers reorder by date or title.
3. **Full-corpus load** — fix the bug where `{{#get "posts" limit="all"}}` silently caps at 100, so all events/interviews are reachable via filter and sort.

All three integrate with the existing chip filter without disturbing it.

## Non-goals

-   Migrating chip filtering off client-side (chips already work on a few hundred posts; keep as is).
-   Replacing the chip filter UI with a Typesense-backed widget (e.g. MagicPages' drop-in widget).
-   Search highlighting in result cards.
-   Search history, suggestions, autocomplete.
-   Analytics on search terms.
-   Maintaining the Typesense → Ghost sync mechanism. That is out of scope and handled separately.
-   A relevance-ranked sort option (sort uses simple date/title only; Typesense's own ranking determines which slugs are _included_, not the visual order, which still respects user's sort choice).
-   Author or date-range filters.

## Decisions and rationale

| Decision                   | Choice                                                                                              | Rationale                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full-corpus load           | Approach A: 20 stacked `{{#get limit=100 page=N}}` blocks via sub-partial. Hard ceiling 2000 posts. | At 287 posts today, the Content API plumbing of approach C is overkill. 20 blocks gives years of runway. Stays fully SSR — no API key, no JS fetch loop, no fetch-error states.                                                                                                                                                                                                                         |
| Search backend             | Typesense, REST API direct from browser                                                             | User has a populated Typesense instance ready (`typesense.advisory.sg`, collection `ghost`). Gives fuzzy matching, full-corpus scope, and no in-DOM payload bloat. We skip MagicPages' UI widget so we keep our own styled search input.                                                                                                                                                                |
| Search field weighting     | `query_by=title,excerpt,plaintext` weighted `4,2,1`                                                 | Title hits matter most; excerpt is a strong signal; body matches are weakest. Standard search UX.                                                                                                                                                                                                                                                                                                       |
| Search → cards mapping     | Typesense returns slugs only (`include_fields=slug`); JS overlays visibility on SSR cards.          | Keeps response payload tiny (~50 bytes per hit). Card data already in DOM from SSR — no need to round-trip the heavy fields.                                                                                                                                                                                                                                                                            |
| Search constraint          | `filter_by=tags.slug:[…]` matching the page's tag set.                                              | The Typesense collection holds _all_ Ghost posts, not just events or interviews. Without this constraint, a search on `/events/` returns slugs for posts that aren't on the page → silent drops. The constraint is sourced from `routes.yaml` and passed as a new partial parameter.                                                                                                                    |
| Search input UX            | Live, debounced 250ms.                                                                              | Live matches the chip behaviour. 250ms (vs 150ms for in-DOM) accounts for network latency.                                                                                                                                                                                                                                                                                                              |
| Search short-circuit       | Skip Typesense call when query length < 2 chars.                                                    | Single-character queries waste bandwidth and produce noise.                                                                                                                                                                                                                                                                                                                                             |
| Stale-request handling     | `AbortController` cancels in-flight requests when a newer query starts.                             | Prevents older response from clobbering newer state.                                                                                                                                                                                                                                                                                                                                                    |
| Search × chips combination | AND (intersect)                                                                                     | What users expect — chip narrows category, search narrows within it.                                                                                                                                                                                                                                                                                                                                    |
| Sort options               | Newest (default) / Oldest / Title A→Z / Title Z→A                                                   | Covers the common needs without a relevance option (see non-goals).                                                                                                                                                                                                                                                                                                                                     |
| Sort implementation        | Client-side reorder of `<div class="filter-card-wrapper">` elements via `appendChild` to grid       | Sort changes only fire on dropdown change (rare). O(n log n) with n ≤ 2000 is fine. No CSS `order:` because card layout is grid. Date sort reads `data-published-at` (ISO string, lexically sortable). Title sort uses `String.prototype.localeCompare` on `data-title`. Hidden cards (`x-show=false`) reorder along with visible ones; CSS Grid lays out only the visible ones in their new DOM order. |
| URL state                  | `?tags=…&q=…&sort=…`                                                                                | All three filterable dimensions persist for sharing/refresh. Defaults (`sort=newest`, empty `q`) omitted.                                                                                                                                                                                                                                                                                               |
| Toolbar layout             | Single row above chips: search input flex-1 left, sort `<select>` right. Wraps on mobile.           | Compact; consistent with existing chip row directly below.                                                                                                                                                                                                                                                                                                                                              |
| Typesense API key handling | Hardcoded constants in `assets/js/typesense-search.js`                                              | The key (`LWQ1uy…`) is a _search-only_ Typesense key — Typesense's analogue of Ghost's Content API key, designed for client-side embedding and read-only scope. Committing it to source is intentional. Future migration to env-var injection if per-env keys become needed.                                                                                                                            |

## Architecture

```
routes.yaml ──> events.hbs / interviews.hbs
                       │
                       │  passes: collection, filter, tagSlugs, mode
                       ↓
             partials/post-filter-list.hbs
                       │
                       ├── toolbar:    search input + sort <select> + searching indicator + error banner
                       ├── chips:      Alpine x-for over availableTags  (unchanged from prior spec)
                       ├── counter:    "Showing X of Y"  (aria-live)    (unchanged)
                       ├── unknown-tags banner                          (unchanged)
                       ├── empty state                                  (copy adapted)
                       ├── post grid:  20 calls to partials/post-filter-page.hbs (page=1..20)
                       │       │
                       │       └── each renders {{#get "posts" limit=100 page=N filter=filter}}
                       │           wrapping each post in <div class="filter-card-wrapper" x-show="isVisible($el)">
                       │
                       └── load-more button                             (unchanged)

                                            ↓ x-data="postFilterList(...)"

                       assets/js/post-filter-list.js
                            ├── filter chip state, sort state, search state
                            ├── reactivity, URL sync
                            └── delegates network calls to:
                                    assets/js/typesense-search.js
                                          ├── fetch() against https://typesense.advisory.sg/...
                                          ├── AbortController per query
                                          └── returns Promise<Set<slug>>
```

## Files

| Path                            | Action    | Purpose                                                                                                                                                                                                                                                        |
| ------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `partials/post-filter-list.hbs` | Modify    | Add toolbar (search + sort); replace single `{{#get limit="all"}}` with 20 calls to sub-partial; thread new params.                                                                                                                                            |
| `partials/post-filter-page.hbs` | **New**   | Tiny partial: one `{{#get limit="100" page=page filter=filter}}` block. ~10 lines.                                                                                                                                                                             |
| `partials/post-card.hbs`        | Modify    | Add `data-slug="{{slug}}"` to `<article>`. Add `data-title="{{title}}"` and `data-published-at="{{date published_at format='YYYY-MM-DDTHH:mm:ss'}}"` (explicit field arg) for client-side sort. (No `data-search-text` — search is server-side via Typesense.) |
| `assets/js/post-filter-list.js` | Modify    | Add `searchQuery`, `sortMode`, `searchSlugs`, `searchError`, `isSearching` state. Add search/sort to filter pipeline. Extend URL r/w.                                                                                                                          |
| `assets/js/typesense-search.js` | **New**   | ~50-line wrapper. Exports `searchSlugs(query, tagSlugs, abortSignal): Promise<Set<string> \| null>`. Constants for host, key, collection at top of file.                                                                                                       |
| `assets/js/main.js`             | No change | Component already registered.                                                                                                                                                                                                                                  |
| `events.hbs`                    | Modify    | Add `tagSlugs="hash-insights,hash-insights-2"` to the partial call. Existing `filter` param unchanged.                                                                                                                                                         |
| `interviews.hbs`                | Modify    | Add `tagSlugs="hash-conversations,hash-conversations-2,hash-conversations-3,hash-reflections,hash-reflections-2"`.                                                                                                                                             |
| `config/routes.yaml`            | No change | Tag lists stay where they are; templates duplicate them in `tagSlugs` form.                                                                                                                                                                                    |

## Data flow

State (all reactive):

```
selectedTags  : string[]            // chip selection
searchQuery   : string              // raw input value
searchSlugs   : Set<string> | null  // null = no search active or query < 2 chars
                                    // Set = the slugs Typesense returned
isSearching   : boolean             // request in-flight, drives spinner
searchError   : boolean             // Typesense unreachable
sortMode      : 'newest'|'oldest'|'az'|'za'
visibleCount  : number              // load-more pagination
```

Pipeline (every render):

```
allCards
   ↓ filter by selectedTags  (chip mode: OR default; AND switchable)
tagFiltered
   ↓ if (searchSlugs !== null): keep only cards where searchSlugs.has(card.slug)
   ↓ else: passthrough
searchAndTagFiltered
   ↓ sort by sortMode
sorted
   ↓ slice(0, visibleCount)
visible          ← what `x-show="isVisible($el)"` renders
```

Triggers:

| Action                | What happens                                                                                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Toggle chip           | `selectedTags` updates. `visibleCount` resets to PAGE_SIZE.                                                                                                                            |
| Type in search input  | After 250ms debounce: if query.length < 2, set `searchSlugs = null`; else fire Typesense (abort prior in-flight). Set `isSearching = true`.                                            |
| Typesense response    | `searchSlugs ← Set(response.hits.map(h => h.document.slug))`. `isSearching = false`. `visibleCount` resets.                                                                            |
| Typesense error       | `searchError = true`. `searchSlugs = null` (so search doesn't filter anything). `isSearching = false`.                                                                                 |
| Clear search input    | `searchSlugs = null`, `searchError = false`. No network call.                                                                                                                          |
| Change sort           | `sortMode` updates. Cards re-ordered in DOM. `visibleCount` resets.                                                                                                                    |
| Click "Load more"     | `visibleCount += PAGE_SIZE`. Focus moves to first newly-revealed card (existing behaviour).                                                                                            |
| Click "Clear filters" | Clears `selectedTags`, `searchQuery`, **and** `searchSlugs`. Resets `sortMode` to `newest`. URL params drop to bare path. (Extends prior behaviour which only cleared `selectedTags`.) |

## URL state

| Param  | Format                               | Default (omitted from URL) |
| ------ | ------------------------------------ | -------------------------- |
| `tags` | `slug1,slug2,…`                      | empty array                |
| `q`    | percent-encoded raw query string     | empty string               |
| `sort` | `newest` \| `oldest` \| `az` \| `za` | `newest`                   |

Writes use `history.replaceState` (do not flood Back button). All three params write together via the same handler — `init()` reads them once on load and seeds initial state.

URL examples:

-   `/events/` — no params, shows everything sorted newest first
-   `/events/?tags=hash-insights` — chip preselected
-   `/events/?q=stoic` — search preseeded; Typesense fired in `init()`
-   `/events/?tags=hash-insights&q=banking&sort=oldest` — all three active

## Network traffic

**Per Typesense request:**

-   **Out:** ~500 bytes (URL ~200 chars + headers + TLS/HTTP-2 overhead). One `X-TYPESENSE-API-KEY` header.
-   **In:** With `include_fields=slug`, each hit ≈ 50 bytes. Typical query (5-20 hits) ≈ 1-2 KB. Pathological maximum (250 hits = `per_page` cap) ≈ 12 KB. Halve those for gzip.
-   **Latency:** ~50-150 ms RTT for SG/SEA users; 200-400 ms overseas.

**First request from a fresh page:**

-   Browser issues a CORS preflight (`OPTIONS`) before the first `GET` — adds one extra round-trip of ~200 bytes. Cached for the page lifetime; subsequent searches don't preflight.

**Per page load (no search yet):**

-   **Zero** Typesense traffic. The component fires only when the user types into the search input (and only after the 250ms debounce, and only when query length ≥ 2).

**Per search session** (one query typed, average 5 chars):

-   Debounce coalesces fast typing to ~1 request per 250ms → 2-3 requests for a typical word.
-   Total session: ~5-15 KB.

**Daily heavy user** (5 search sessions): ~25-75 KB. Negligible.

**Comparison to the in-DOM alternative considered and rejected:**

|                      | In-DOM search (rejected)               | Typesense (chosen) |
| -------------------- | -------------------------------------- | ------------------ |
| Initial page weight  | +400 KB (plaintext attrs on each card) | 0                  |
| Per search session   | 0                                      | ~5-15 KB           |
| Per day (heavy user) | 0                                      | ~25-75 KB          |

Typesense is overall lighter for typical browsing because the up-front payload cost dominates the per-query cost.

## Typesense request shape

```
GET https://typesense.advisory.sg/collections/ghost/documents/search
    ?q=<encoded query>
    &query_by=title,excerpt,plaintext
    &query_by_weights=4,2,1
    &include_fields=slug
    &per_page=250
    &filter_by=tags.slug:[<page tag slugs joined by comma>]

Headers:
    X-TYPESENSE-API-KEY: LWQ1uyADTZBRVJa0XuFY5BcipgnhvQ8g
```

Response (relevant fields only):

```
{
    "found": 7,
    "hits": [
        { "document": { "slug": "conversations-with-foo" } },
        ...
    ]
}
```

`searchSlugs ← new Set(hits.map(h => h.document.slug))`.

Schema verified live on 2026-05-06: collection `ghost`, 283 documents, indexed fields include `title`, `slug`, `excerpt`, `plaintext`, `tags.slug`, `tags.name`, `published_at`, `updated_at`, `authors`, `url`, `feature_image`, `html`.

## Error handling and edge cases

-   **Typesense unreachable / 5xx / non-JSON response:** Catch in `typesense-search.js`, propagate as a rejected promise. `post-filter-list.js` sets `searchError = true`, leaves `searchSlugs = null` (so search becomes a passthrough). Banner appears: _"Search temporarily unavailable. Filters and sorting still work."_ Banner clears when user clears the search input.
-   **Aborted in-flight request** (user typed again before previous returned): `AbortController.abort()`. The rejected promise must be distinguishable from a real error — `if (err.name === 'AbortError') return;` so we don't set `searchError`.
-   **Empty query / query < 2 chars:** `searchSlugs = null`. Pipeline skips the search filter entirely. No network call.
-   **Typesense returns 0 hits:** `searchSlugs = new Set()`. Pipeline filters everything out → empty state. Empty-state copy adapts: _"No posts match your search."_ / _"…your search and filters."_ / _"…your selected tags."_ depending on which inputs are active.
-   **`?q=…` in URL on initial load:** `init()` seeds `searchQuery`, fires Typesense after Alpine mount. While in-flight, grid renders unfiltered (since `searchSlugs` is still `null`). Acceptable brief flash; alternative (hide grid until first search resolves) penalises every user for a query that nearly always returns >0 results.
-   **Search with regex/emoji/special characters:** Typesense handles these natively; we only `encodeURIComponent` the query for URL safety.
-   **Unknown sort value in URL** (`?sort=garbage`): silently fall back to `newest`. No banner.
-   **Unknown tag slugs in URL:** existing amber banner behaviour (kept from prior spec).
-   **Sort during ongoing search:** Sort runs over whatever `searchSlugs` is _now_. When the search response arrives, the pipeline re-runs and re-sorts. No special handling needed.
-   **CORS not configured on Typesense host:** First request fails preflight. `searchError = true`, banner shows. Operationally a one-time setup issue, not a runtime concern.
-   **Hard page-load ceiling reached** (>2000 events or interviews): the 21st page never renders. Posts beyond rank 2000 are invisible to the chip filter and sort, AND any Typesense slug match for them produces a silent drop (slug not in any loaded card). At current growth rate this is years away. Documented for future re-evaluation when total approaches 1500.

## Accessibility

-   **Search input:** `<label for="post-search-{{collection}}" class="sr-only">Search posts</label>` paired with visible placeholder. `aria-controls` references the grid id. Pressing `Esc` clears the input and refocuses it.
-   **Sort dropdown:** native `<select>` with visible `<label>` ("Sort:"). Best out-of-box screen reader and keyboard support; no ARIA required.
-   **Searching indicator:** small `<span aria-live="polite">Searching…</span>` next to the input while `isSearching`. Disappears on response.
-   **Live region** (existing): `role="status" aria-live="polite"` announces _"Showing X of Y"_ on every state change. Debounced naturally by Alpine reactivity timing — no per-keystroke spam because the search itself is debounced.
-   **Error banner:** `role="alert"` for the Typesense-unavailable case so it's announced when it appears.
-   **Empty-state copy** is announced via the live region (counter shows "0 of N").
-   **Keyboard tab order:** search input → sort dropdown → chips → first card → load-more.
-   **No focus trap, no modal patterns.**

## Testing and verification

No automated tests (theme has no test framework). Manual verification matrix to be exercised in the implementation phase:

1. Page loads `/events/` — toolbar visible, chips visible, all 287-or-so posts present in DOM.
2. Type "stoic" → results narrow live, count updates, URL gets `?q=stoic`.
3. Click an interviews-related chip → chip toggles state. Combined with search, AND-narrows.
4. Change sort to "Title A→Z" → cards visually reorder. Sort persists in URL.
5. Refresh `/events/?q=banking&tags=hash-insights&sort=oldest` → all three pre-applied correctly.
6. Disconnect from Typesense (block `typesense.advisory.sg` in DevTools) → banner appears on next search; chips and sort still work.
7. Type "x" (one char) → no Typesense request fires. Type "xy" → request fires.
8. Type fast: open Network panel and confirm in-flight requests get cancelled (`status: cancelled`).
9. Disable JavaScript → all 287 posts visible in static grid; no toolbar; no chip UI. Acceptable degradation.
10. Mobile viewport (375px) → toolbar wraps to two rows (search above, sort below).
11. Tab through controls with keyboard, screen reader on (NVDA / VoiceOver). Searching state, count, error banner all announce.
12. Same matrix on `/interviews/`.
13. Verify `/posts/` (uses `index.hbs`) is **not** affected — no toolbar, no chips, plain grid.

## Future migration paths

Documented to avoid surprise later, **not** committed to in this spec:

-   **Approach C migration (full corpus past 2000 posts):** when post count approaches 1500, re-evaluate. Replace the 20 SSR blocks with first-100 SSR + JS Content API fetch loop for pages 2..N. Card identity (`data-slug`) stays the same. Search and sort code unchanged.
-   **Per-environment Typesense host/key:** swap the constants in `typesense-search.js` for build-time `process.env.*` injection via webpack `DefinePlugin`. The component boundary doesn't change.
-   **Replace native sort with a styled menu:** drop-in if design ever wants it. Adapter point is the `<select>` element.
-   **Add relevance-ranked sort:** would need to surface Typesense's hit order; currently we discard it. Add an `'relevance'` sortMode that bypasses client-side sort and uses the slug arrival order from Typesense.

## Out of scope (re-emphasised)

-   Typesense indexing / sync mechanism — handled separately.
-   Replacing the existing chip filter with Typesense `filter_by` — chips stay client-side because they're already implemented and fast.
-   Post-card visual changes beyond adding three data attributes.
-   Touching `/posts/`, tag pages, or any non-events/interviews listing.
-   Any change to `routes.yaml` content (tag slug lists are duplicated into the templates as a `tagSlugs` parameter; routes.yaml stays the source of truth).
-   Search analytics, search history, suggestions, autocomplete, highlighting.
