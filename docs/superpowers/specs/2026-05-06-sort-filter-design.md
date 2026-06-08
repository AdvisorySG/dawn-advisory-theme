# Sort & Filter on Interviews and Events — Design

**Date:** 2026-05-06
**Status:** Approved, ready for implementation planning
**Related:** `2026-05-06-features-overview.md`

## Goal

Let readers filter the post listings on `/events/` and `/interviews/` by tag,
in place, without leaving the page. URL reflects the active filter so it can
be bookmarked and shared.

Sort is fixed at newest-first (no sort UI in v1).

## Non-goals

-   Sort controls (date is fixed newest-first)
-   Filter by author, year, or full-text search
-   Filter on `/posts/`, tag pages, or any other listing
-   Server-side filter routing (Ghost `routes.yaml` collection variants)
-   Analytics events on filter changes
-   Suggested-articles improvements (Feature 2 — separate spec)

## Decisions and rationale

| Decision                     | Choice                                              | Rationale                                                                                              |
| ---------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Architecture                 | Client-side filter over server-rendered post list   | Few hundred posts is small enough to fit in DOM. Avoids Content API auth and fetch latency.            |
| Filter dimensions            | Tag only, multi-select                              | User-requested. Author/year deferred to YAGNI.                                                         |
| Combine mode                 | OR by default, AND switchable via partial parameter | Default chosen for broader results / less empty-state surprise. AND code path required for future use. |
| Sort                         | Fixed `published_at desc`                           | User chose only this option. No UI needed.                                                             |
| Pagination                   | "Load more" button, batch 12                        | Matches existing `posts_per_page`, simpler than numbered pages, no `page` URL param.                   |
| URL state                    | `?tags=<slug>,<slug>` only                          | Filter state is shareable and survives refresh; load-more state is ephemeral.                          |
| History API                  | `replaceState` (not `pushState`)                    | Chip toggles should not flood browser history. Back button still navigates pages.                      |
| Unknown tag slugs in URL     | Kept in `selectedTags`, surfaced in amber banner    | User-requested over silent drop, makes stale links visible.                                            |
| Generic `/posts/` collection | No filter UI                                        | `index.hbs` is shared; we create a dedicated `interviews.hbs` rather than conditionally render.        |

## Architecture

```
events.hbs ─────┐
                ├──> partials/post-filter-list.hbs
interviews.hbs ─┘         │
                          ├── filter chips (Alpine x-data)
                          ├── server-rendered list of all matching posts
                          ├── "X of Y" counter (aria-live)
                          ├── unknown-tags banner (conditional)
                          ├── empty state (conditional)
                          └── "Load more" button (conditional)

assets/js/post-filter-list.js  ──> Alpine.data('postFilterList', ...)
assets/js/main.js              ──> imports + registers component
```

## Files

### New files

-   `interviews.hbs` — mirrors current `index.hbs`, renders
    `{{> post-filter-list collection="interviews"}}`.
-   `partials/post-filter-list.hbs` — filter UI + post grid + load-more.
    Accepts `collection` (string) and `mode` (`"or"` default, `"and"`).
-   `assets/js/post-filter-list.js` — Alpine component definition. Default
    export is the registration function so `main.js` can call
    `Alpine.data('postFilterList', register())`.

### Modified files

-   `events.hbs` — replace tags-listing + foreach + pagination block with
    `{{> post-filter-list collection="events"}}`.
-   `partials/post-card.hbs` — add `data-tags="<comma-separated slugs>"` to
    the root `<article>` element. Built from
    `{{#foreach tags visibility="public"}}{{slug}}{{#unless @last}},{{/unless}}{{/foreach}}`.
    Internal tags (hash-prefixed routing tags such as `#insights`,
    `#conversations`) are excluded so they don't surface as filter chips.
-   `assets/js/main.js` — import `post-filter-list.js`, register the
    Alpine component before `Alpine.start()`.
-   `config/routes.yaml` — change `/interviews/` template from `index` to
    `interviews`.

### Untouched files

-   `partials/tags-listing.hbs` — left as-is (no longer rendered by
    events/interviews, but harmless).
-   `index.hbs` — still serves `/posts/` without filter UI.
-   `tag.hbs` — still serves `/tag/<slug>/` without filter UI.

## Component interface

### Partial

```handlebars
{{> post-filter-list
    collection="events"
    filter="tag:hash-insights"
    mode="or"}}
```

-   `collection` — string label, used for the wrapper DOM id and as a
    namespace prefix if both filters ever appear on the same page.
-   `filter` — Ghost filter string passed straight to `{{#get "posts"}}`.
    Mirrors the collection filter from `routes.yaml`
    (`tag:hash-insights` for events,
    `tag:[hash-conversations,hash-reflections]` for interviews) so the
    partial fetches the same set the page would have rendered.
-   `mode` — `"or"` (default) or `"and"`. Selects matching function.

### Alpine component

```javascript
Alpine.data("postFilterList", ({ collection, mode }) => ({
    selectedTags: [], // tag slugs currently active
    visibleCount: 12, // load-more counter
    allCards: [], // [{ el: HTMLElement, tagSlugs: Set<string> }]
    availableTags: [], // [{ slug, name }] — tags present on this page

    init() {
        this.allCards = this._readCardsFromDom();
        this.availableTags = this._buildAvailableTags();
        this.selectedTags = this._readTagsFromUrl();
        this.$watch("selectedTags", () => {
            this.visibleCount = 12;
            this._writeTagsToUrl();
        });
    },

    matches(card) {
        if (this.selectedTags.length === 0) return true;
        if (mode === "and") {
            return this.selectedTags.every((t) => card.tagSlugs.has(t));
        }
        return this.selectedTags.some((t) => card.tagSlugs.has(t));
    },

    filtered() {
        return this.allCards.filter((c) => this.matches(c));
    },
    visible() {
        return this.filtered().slice(0, this.visibleCount);
    },

    unknownTags() {
        const known = new Set(this.availableTags.map((t) => t.slug));
        return this.selectedTags.filter((s) => !known.has(s));
    },

    toggleTag(slug) {
        /* add or remove */
    },
    loadMore() {
        this.visibleCount += 12;
    },
    clearFilters() {
        this.selectedTags = [];
    },
}));
```

Display is driven by `x-show` on each card (rather than rerendering the
list) — Alpine's reactivity hides cards that don't match or fall outside
`visibleCount`.

## Data flow

### Page load

1. Ghost resolves `/events/` → `events.hbs` → renders
   `{{> post-filter-list collection="events"}}`.
2. Partial calls
   `{{#get "posts" limit="1000" filter=filter include="tags" order="published_at desc"}}`
   (where `filter` is the partial parameter — `tag:hash-insights` for
   events, `tag:[hash-conversations,hash-reflections]` for interviews)
   to fetch every matching post in one query.
3. Each post renders as a `post-card` with
   `data-tags="<slug-1>,<slug-2>"` on the root `<article>`.
4. Alpine `init()` runs:
    - Reads `?tags=` from URL into `selectedTags`.
    - Walks the DOM, builds `allCards` and `availableTags`.
5. Reactive bindings show/hide cards according to `matches()` and
   `visibleCount`. Counter and load-more state render accordingly.

### Toggle a chip

1. `toggleTag(slug)` updates `selectedTags`.
2. `$watch('selectedTags')` resets `visibleCount` to 12 and rewrites the URL.
3. Cards re-evaluate `x-show`.
4. Empty state, unknown-tags banner, and load-more visibility update reactively.

### Load more

1. `visibleCount += 12`. Cards in the new range become visible.
2. URL is **not** updated.
3. Focus moves to the first newly-revealed card for keyboard users.

### URL handling

-   Read on init:
    ```js
    const params = new URLSearchParams(location.search);
    const raw = params.get("tags") || "";
    return raw.split(",").filter(Boolean);
    ```
-   Write on change (via `$watch`):
    ```js
    const params = new URLSearchParams(location.search);
    if (this.selectedTags.length) {
        params.set("tags", this.selectedTags.join(","));
    } else {
        params.delete("tags");
    }
    const qs = params.toString();
    history.replaceState(
        null,
        "",
        qs ? `${location.pathname}?${qs}` : location.pathname,
    );
    ```

### Matching

```
match(card):
  if selectedTags.length === 0 → true
  if mode === "or"  → selectedTags.some(t => card.tagSlugs.has(t))
  if mode === "and" → selectedTags.every(t => card.tagSlugs.has(t))
```

## Edge cases

| Case                                                  | Behavior                                                                                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| No selected tags                                      | All posts show.                                                                                                                      |
| Selected tag exists on this page                      | Filter applies normally.                                                                                                             |
| Selected tag does not exist on this page (any reason) | Card filter naturally returns 0; amber banner lists the unknown slugs.                                                               |
| URL has empty/malformed `?tags=`                      | `.filter(Boolean)` strips empties; nothing breaks.                                                                                   |
| Filter applied → load more clicked → filter changed   | `visibleCount` resets to 12.                                                                                                         |
| Zero matches, no unknown tags                         | Empty-state message + `[Clear filters]` button.                                                                                      |
| Zero matches, with unknown tags                       | Amber banner + empty-state message + `[Clear filters]`.                                                                              |
| JS disabled or fails to load                          | Server-rendered list of all matching posts is fully visible and readable. Filter UI is non-interactive but page degrades gracefully. |
| Collection has more than 1000 posts                   | Graceful failure: only first 1000 render. We revisit and switch to Content API if/when it happens.                                   |

## SEO

-   Add `<link rel="canonical" href="{{@site.url}}{{path}}">` to the new
    `interviews.hbs` and to `events.hbs` if `{{ghost_head}}` does not already
    emit one. Filtered URLs (`?tags=...`) canonicalize to the unfiltered page.
-   No `noindex` on filtered URLs — they're useful for direct visits.

## Accessibility

-   Chips are `<button type="button" role="checkbox" :aria-checked="selected">`.
-   Selection communicated by both color and a checkmark icon (not color
    alone).
-   Counter wrapped in `<div role="status" aria-live="polite">`.
-   Empty-state message and unknown-tags banner are real text, focusable
    buttons.
-   "Load more" is a `<button>`. After click, focus moves to the first
    newly-revealed card.

## Testing

No test framework added. Validation comes from:

1. **`npm run test`** (gscan) — must pass with no errors.
2. **`npm run dev`** (gulp + webpack + tailwind) — must complete clean.
3. **Manual scenarios** against `localhost:2368`:
    - Filter on/off, single tag, multiple tags (OR)
    - Clear filters
    - Load more, then filter change resets count
    - URL preload: valid tags, unknown tags, mixed, malformed, empty
    - Repeat on `/interviews/` with interview tag set
    - `/posts/` and `/tag/<slug>/` show no filter UI
    - JS disabled → page still readable
    - Keyboard tab + space toggles chips, `aria-live` announces counts
    - Mobile viewport: chips wrap, layout doesn't break
    - Switch `mode="and"` in `events.hbs`, rebuild, verify two chips → both-required behavior, then revert

## Open questions for implementation

-   Does `{{ghost_head}}` already emit a canonical URL? Check during
    implementation; only add manual `<link rel="canonical">` if missing.
-   Is there an existing Tailwind component pattern for buttons / pills in
    this theme? Check `assets/css` and reuse if so.

## Out of scope (deferred)

-   Sort controls
-   Author / year filters
-   Analytics events on filter changes
-   Filter on generic `/posts/`, tag, or author pages
-   Filter persistence beyond URL (no localStorage)
-   Server-side filtering or Content API fallback (only if collections grow
    past ~1000 posts)
