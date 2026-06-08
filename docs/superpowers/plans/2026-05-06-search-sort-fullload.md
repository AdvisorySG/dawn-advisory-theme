# Search, Sort, and Full-corpus Load Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing tag-filter UI on `/events/` and `/interviews/` with a sort dropdown and a Typesense-backed search box, and fix the silent 100-post cap caused by `{{#get "posts" limit="all"}}`.

**Architecture:** Stays SSR-first. The `{{#get}}` cap is fixed by stacking 20 explicit page calls (limit=100, page=1..20) via a new sub-partial — hard ceiling 2000 posts. Sort is client-side DOM reorder (`appendChild` rearranges `.filter-card-wrapper` nodes; CSS Grid follows DOM order). Search is server-side via Typesense's REST API: a small wrapper module turns a query string + page-tag-slug constraint into a `Set<slug>`; the existing Alpine component intersects that set with the chip filter to control card visibility. URL syncs `tags`, `q`, and `sort`.

**Tech Stack:** Ghost theme (Handlebars partials, `routes.yaml`), Alpine.js (already a dep), Tailwind CSS (already a dep), webpack via gulp (already configured). New dep: none. New external: Typesense REST endpoint at `typesense.advisory.sg`.

**Spec:** `docs/superpowers/specs/2026-05-06-search-sort-fullload-design.md`

**Implementation order (per user):** full-corpus load → sort → search.

## Working environment

-   Local Ghost instance at `http://localhost:2368` with this theme installed.
-   Build the theme one-shot: `npx gulp build` (compiles HBS, CSS, JS into `assets/built/`).
-   Watch mode for active dev: `npm run dev` (build + livereload + watch). Leave it running in a separate terminal.
-   Theme linter: `npm run test` (`gscan .`). Must show no errors. CI form: `npm run test:ci`.
-   Pre-commit hook (husky + pretty-quick) runs Prettier on staged files. Don't fight it — let it reformat.
-   Restart Ghost after any change to `routes.yaml`. (No `routes.yaml` change in this plan — but be aware.)
-   All tasks commit to the current branch (`filter-addition`).
-   Typesense schema verified live on 2026-05-06: collection `ghost`, 283 documents, fields include `title`, `slug`, `excerpt`, `plaintext`, `tags.slug`, `published_at`. The search-only API key in `assets/js/typesense-search.js` is intentionally public (read-only scope, Typesense convention).

## File map

**Created:**

-   `partials/post-filter-page.hbs` — tiny sub-partial: one `{{#get limit=100 page=N filter=…}}` block.
-   `assets/js/typesense-search.js` — wrapper exporting `searchSlugs(query, tagSlugs, signal): Promise<Set<string>>`.

**Modified:**

-   `partials/post-filter-list.hbs` — replace single `{{#get limit="all"}}` with 20 stacked sub-partial calls; add toolbar (sort + search); add error banner; adapt empty state and Clear-filters scope; add `id` to post grid for `aria-controls`.
-   `partials/post-card.hbs` — add `data-slug`, `data-title`, `data-published-at` attributes on the root `<article>`.
-   `assets/js/post-filter-list.js` — extend Alpine component: read new attributes; add `sortMode`, `searchQuery`, `searchSlugs`, `searchError`, `isSearching`, `tagSlugs`; add `_runSearch`, `_sorted`, `_reorderDom`; rename URL helpers to `_readStateFromUrl` / `_writeStateToUrl` (handle `tags`, `q`, `sort`); extend `clearFilters`; integrate search slug filter into `filtered()`.
-   `events.hbs` — add `tagSlugs="hash-insights,hash-insights-2"` to the partial call.
-   `interviews.hbs` — add `tagSlugs="hash-conversations,hash-conversations-2,hash-conversations-3,hash-reflections,hash-reflections-2"` to the partial call.

**Untouched:**

-   `assets/js/main.js` — component already registered.
-   `config/routes.yaml` — tag lists stay there; templates duplicate them as `tagSlugs`.
-   `index.hbs`, `tag.hbs`, any other listing — out of scope.
-   CSS files — Tailwind utilities only, applied inline.

---

## Task 1: Full-corpus load — sub-partial + 20 stacked page blocks

**Files:**

-   Create: `partials/post-filter-page.hbs`
-   Modify: `partials/post-filter-list.hbs:71-87` (the existing `{{#get limit="all"}}` block in the post grid)

Ghost's `{{#get}}` helper silently caps `limit="all"` at 100 posts. Approach A from the spec: stack 20 explicit page=1..20 calls, each `limit=100`, factor the per-page block into a sub-partial to keep the parent readable. Pages past the end render empty.

-   [ ] **Step 1: Create `partials/post-filter-page.hbs`**

```handlebars
{{!-- Renders one page (up to 100 posts) for post-filter-list.hbs.
     Receives:
       page    — string "1".."20" (Ghost's {{#get}} accepts string page arg)
       filter  — Ghost filter expression (same one used on every page block)
     Cards are wrapped in .filter-card-wrapper so the parent Alpine component
     can show/hide them via x-show. --}}
<!-- djlint:off -->
{{#get "posts" limit="100" page=page filter=filter include="tags" order="published_at desc" as |posts|}}
<!-- djlint:on -->
    {{#foreach posts}}
        <div
            x-show="isVisible($el)"
            tabindex="-1"
            class="filter-card-wrapper">
            {{> "post-card"}}
        </div>
    {{/foreach}}
{{/get}}
```

-   [ ] **Step 2: Replace the post-grid block in `partials/post-filter-list.hbs`**

Find this block (currently lines 71-87):

```handlebars
{{!-- Server-rendered post grid. NO x-cloak: JS-disabled users still see all posts. --}}
<div class="post-feed container grid grid-cols-1 lg:grid-cols-3 gap-x-20 gap-y-10 m-auto">
    <!-- djlint:off -->
    {{#get "posts" limit="all" filter=filter include="tags" order="published_at desc" as |posts|}}
    <!-- djlint:on -->
        {{#foreach posts}}
            {{!-- The wrapper is the filter unit: tagged via its [data-tags] child,
                 focusable for keyboard users via tabindex="-1", and reactive via x-show. --}}
            <div
                x-show="isVisible($el)"
                tabindex="-1"
                class="filter-card-wrapper">
                {{> "post-card"}}
            </div>
        {{/foreach}}
    {{/get}}
</div>
```

Replace with:

```handlebars
{{!-- Server-rendered post grid. 20 stacked page blocks (limit=100 each) work
     around Ghost's silent 100-post cap on limit="all". Hard ceiling: 2000 posts.
     NO x-cloak: JS-disabled users still see all posts. --}}
<div id="post-grid-{{collection}}" class="post-feed container grid grid-cols-1 lg:grid-cols-3 gap-x-20 gap-y-10 m-auto">
    {{> "post-filter-page" page="1" filter=filter}}
    {{> "post-filter-page" page="2" filter=filter}}
    {{> "post-filter-page" page="3" filter=filter}}
    {{> "post-filter-page" page="4" filter=filter}}
    {{> "post-filter-page" page="5" filter=filter}}
    {{> "post-filter-page" page="6" filter=filter}}
    {{> "post-filter-page" page="7" filter=filter}}
    {{> "post-filter-page" page="8" filter=filter}}
    {{> "post-filter-page" page="9" filter=filter}}
    {{> "post-filter-page" page="10" filter=filter}}
    {{> "post-filter-page" page="11" filter=filter}}
    {{> "post-filter-page" page="12" filter=filter}}
    {{> "post-filter-page" page="13" filter=filter}}
    {{> "post-filter-page" page="14" filter=filter}}
    {{> "post-filter-page" page="15" filter=filter}}
    {{> "post-filter-page" page="16" filter=filter}}
    {{> "post-filter-page" page="17" filter=filter}}
    {{> "post-filter-page" page="18" filter=filter}}
    {{> "post-filter-page" page="19" filter=filter}}
    {{> "post-filter-page" page="20" filter=filter}}
</div>
```

The `id="post-grid-{{collection}}"` is added now in preparation for the search input's `aria-controls` in Task 8 — harmless until then.

-   [ ] **Step 3: Build and lint**

```
npx gulp build
npm run test
```

Both should complete with no errors. `gscan` may emit informational notes but should not fail.

-   [ ] **Step 4: Manually verify in browser**

With `npm run dev` running and Ghost serving the theme:

1. Load `http://localhost:2368/events/`. Open DevTools → Console, paste: `document.querySelectorAll('.filter-card-wrapper').length`. Should report the full count of events posts (more than 100).
2. Same on `http://localhost:2368/interviews/`. Should report the full count.
3. Counter ("Showing X of Y") should reflect the higher number, not be capped at 100.
4. Click any tag chip. Filter should still narrow correctly.

-   [ ] **Step 5: Commit**

```
git add partials/post-filter-page.hbs partials/post-filter-list.hbs
git commit -m "fix(filter): full-corpus load via 20 stacked {{#get}} page blocks"
```

---

## Task 2: Add `data-slug`, `data-title`, `data-published-at` to `post-card.hbs`

**Files:**

-   Modify: `partials/post-card.hbs:1-4`

Add three attributes the Alpine component needs for sort and search. `data-published-at` uses a lexically-sortable, second-precision format. `data-slug` is the join key for Typesense results. `data-title` is for the title sort comparator.

-   [ ] **Step 1: Edit the root `<article>` element**

Find lines 1-4:

```handlebars
<article
    class="feed-card {{post_class}} rounded-lg shadow-2xl m-auto w-full max-w-2xl md:max-w-full lg:h-full hover:shadow-md hover:border-opacity-0 transform hover:-translate-y-1 transition-all duration-200"
    data-tags="{{#foreach tags visibility='public'}}{{slug}}{{#unless @last}},{{/unless}}{{/foreach}}"
    data-tag-names="{{#foreach tags visibility='public'}}{{name}}{{#unless @last}}|{{/unless}}{{/foreach}}">
```

Replace with:

```handlebars
<article
    class="feed-card {{post_class}} rounded-lg shadow-2xl m-auto w-full max-w-2xl md:max-w-full lg:h-full hover:shadow-md hover:border-opacity-0 transform hover:-translate-y-1 transition-all duration-200"
    data-tags="{{#foreach tags visibility='public'}}{{slug}}{{#unless @last}},{{/unless}}{{/foreach}}"
    data-tag-names="{{#foreach tags visibility='public'}}{{name}}{{#unless @last}}|{{/unless}}{{/foreach}}"
    data-slug="{{slug}}"
    data-title="{{title}}"
    data-published-at="{{date published_at format='YYYY-MM-DD HH:mm:ss'}}">
```

Format `'YYYY-MM-DD HH:mm:ss'` is lexically sortable (so a string comparator works for date sort) and explicit about the `published_at` field (Ghost's `{{date}}` helper requires the field arg to avoid relying on context defaults).

-   [ ] **Step 2: Build and lint**

```
npx gulp build
npm run test
```

-   [ ] **Step 3: Manually verify in browser**

Reload `http://localhost:2368/events/`. Inspect any `.feed-card`. Confirm all five `data-*` attributes are present:

```
data-tags="..."
data-tag-names="..."
data-slug="conversations-with-..."  (or the post's actual slug)
data-title="..."
data-published-at="2024-03-15 10:30:00"  (or similar; valid ISO-ish format)
```

-   [ ] **Step 4: Commit**

```
git add partials/post-card.hbs
git commit -m "feat(post-card): expose slug, title, published-at as data attributes"
```

---

## Task 3: Sort state, sort pipeline, URL state refactor

**Files:**

-   Modify: `assets/js/post-filter-list.js` (whole file)

Add the sort feature in JS without UI yet. Three intertwined changes:

1. Extend `_readCardsFromDom` to capture `slug`, `title`, `publishedAt` per card (slug used in Task 7's search; title and publishedAt used here for sort).
2. Add `sortMode` state, `_sorted(cards)` comparator, and `_reorderDom()` that rearranges DOM nodes via `appendChild` to match the sort order.
3. Replace `_readTagsFromUrl` / `_writeTagsToUrl` with `_readStateFromUrl` / `_writeStateToUrl` that handle `tags` and `sort` (and leave room for `q` in Task 7).

-   [ ] **Step 1: Replace `assets/js/post-filter-list.js` with the full updated component**

```javascript
// Alpine component for client-side multi-tag filter, sort, search, load-more, and URL sync.
// Used by partials/post-filter-list.hbs on /events/ and /interviews/.
//
// Call site:
//   <div x-data="postFilterList({ collection: 'events', mode: 'or', tagSlugs: 'hash-insights,...' })" ...>
//
// Parameters:
//   collection: passed through for the partial's DOM id namespace; not used here.
//   mode: 'or' (default) or 'and'. Selects matching function for chips.
//   tagSlugs: comma-separated string of tag slugs scoping this collection (used by Task 7 for Typesense filter_by). Not consumed in Task 3.
export default function postFilterList({ collection, mode, tagSlugs }) {
    const PAGE_SIZE = 12;

    return {
        // --- state -------------------------------------------------------
        selectedTags: [],
        sortMode: "newest", // 'newest' | 'oldest' | 'az' | 'za'
        visibleCount: PAGE_SIZE,
        allCards: [],
        availableTags: [],
        tagSlugs: (tagSlugs || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),

        // --- lifecycle ---------------------------------------------------

        init() {
            this.allCards = this._readCardsFromDom();
            this.availableTags = this._buildAvailableTags(this.allCards);

            const state = this._readStateFromUrl();
            this.selectedTags = state.tags;
            this.sortMode = state.sort;

            this.$watch("selectedTags", () => {
                this.visibleCount = PAGE_SIZE;
                this._writeStateToUrl();
            });
            this.$watch("sortMode", () => {
                this.visibleCount = PAGE_SIZE;
                this._reorderDom();
                this._writeStateToUrl();
            });

            // Apply initial DOM order if URL specified a non-default sort.
            if (this.sortMode !== "newest") {
                this._reorderDom();
            }
        },

        // --- queries -----------------------------------------------------

        matches(card) {
            if (this.selectedTags.length === 0) return true;
            if (mode === "and") {
                return this.selectedTags.every((t) => card.tagSlugs.has(t));
            }
            return this.selectedTags.some((t) => card.tagSlugs.has(t));
        },

        filtered() {
            const tagFiltered = this.allCards.filter((c) => this.matches(c));
            // Search filter (added in Task 7).
            return this._sorted(tagFiltered);
        },

        visible() {
            return this.filtered().slice(0, this.visibleCount);
        },

        // el must be the .filter-card-wrapper element (the same node stored in allCards).
        // The wrapper carries tabindex="-1" so loadMore() can focus it.
        isVisible(el) {
            return this.visible().some((c) => c.el === el);
        },

        unknownTags() {
            const known = new Set(this.availableTags.map((t) => t.slug));
            return this.selectedTags.filter((s) => !known.has(s));
        },

        hasMore() {
            return this.filtered().length > this.visibleCount;
        },

        // --- actions -----------------------------------------------------

        isSelected(slug) {
            return this.selectedTags.includes(slug);
        },

        toggleTag(slug) {
            if (this.isSelected(slug)) {
                this.selectedTags = this.selectedTags.filter((s) => s !== slug);
            } else {
                this.selectedTags = [...this.selectedTags, slug];
            }
        },

        loadMore() {
            this.visibleCount += PAGE_SIZE;
            // Move focus to the first newly-revealed card for keyboard users.
            this.$nextTick(() => {
                const newIndex = this.visibleCount - PAGE_SIZE;
                const card = this.filtered()[newIndex];
                if (card && card.el) card.el.focus();
            });
        },

        clearFilters() {
            this.selectedTags = [];
            this.sortMode = "newest";
            // Search reset added in Task 7.
        },

        // --- internals ---------------------------------------------------

        _sorted(cards) {
            const sorted = [...cards];
            switch (this.sortMode) {
                case "oldest":
                    sorted.sort((a, b) =>
                        a.publishedAt.localeCompare(b.publishedAt),
                    );
                    break;
                case "az":
                    sorted.sort((a, b) => a.title.localeCompare(b.title));
                    break;
                case "za":
                    sorted.sort((a, b) => b.title.localeCompare(a.title));
                    break;
                case "newest":
                default:
                    sorted.sort((a, b) =>
                        b.publishedAt.localeCompare(a.publishedAt),
                    );
                    break;
            }
            return sorted;
        },

        // Reorders ALL .filter-card-wrapper nodes in the grid to match the current sort.
        // Hidden cards (x-show=false) reorder along with visible ones; CSS Grid then
        // lays out only the visible ones in their new DOM order.
        _reorderDom() {
            if (this.allCards.length === 0) return;
            const grid = this.allCards[0].el.parentNode;
            if (!grid) return;
            const sorted = this._sorted(this.allCards);
            sorted.forEach((c) => grid.appendChild(c.el));
        },

        _readCardsFromDom() {
            const root = this.$root || this.$el;
            const wrappers = root.querySelectorAll(".filter-card-wrapper");
            return Array.from(wrappers).map((el) => {
                const inner = el.querySelector("[data-tags]");
                const slugs = (
                    inner && inner.dataset.tags ? inner.dataset.tags : ""
                )
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                return {
                    el,
                    tagSlugs: new Set(slugs),
                    slug: (inner && inner.dataset.slug) || "",
                    title: (inner && inner.dataset.title) || "",
                    publishedAt: (inner && inner.dataset.publishedAt) || "",
                };
            });
        },

        _buildAvailableTags(cards) {
            const map = new Map();
            cards.forEach(({ el }) => {
                const inner = el.querySelector("[data-tags]");
                if (!inner) return;
                const slugs = (inner.dataset.tags || "").split(",");
                const names = (inner.dataset.tagNames || "").split("|");
                slugs.forEach((slug, i) => {
                    const s = slug.trim();
                    if (!s) return;
                    if (!map.has(s)) {
                        map.set(s, { slug: s, name: (names[i] || s).trim() });
                    }
                });
            });
            return Array.from(map.values()).sort((a, b) =>
                a.name.localeCompare(b.name),
            );
        },

        _readStateFromUrl() {
            const params = new URLSearchParams(window.location.search);

            const tags = (params.get("tags") || "")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);

            const rawSort = params.get("sort") || "newest";
            const validSorts = ["newest", "oldest", "az", "za"];
            const sort = validSorts.includes(rawSort) ? rawSort : "newest";

            return { tags, sort };
        },

        _writeStateToUrl() {
            const params = new URLSearchParams(window.location.search);

            if (this.selectedTags.length) {
                params.set("tags", this.selectedTags.join(","));
            } else {
                params.delete("tags");
            }

            if (this.sortMode && this.sortMode !== "newest") {
                params.set("sort", this.sortMode);
            } else {
                params.delete("sort");
            }

            const qs = params.toString();
            const newUrl = qs
                ? `${window.location.pathname}?${qs}`
                : window.location.pathname;
            window.history.replaceState(null, "", newUrl);
        },
    };
}
```

-   [ ] **Step 2: Build and lint**

```
npx gulp build
npm run test
```

-   [ ] **Step 3: Manually verify in browser (DevTools console)**

Reload `http://localhost:2368/events/`. Open DevTools → Console:

```javascript
// Confirm the new fields are populated.
const c = Alpine.$data(document.querySelector('[x-data^="postFilterList"]'));
console.log(
    c.allCards.slice(0, 3).map((x) => ({
        slug: x.slug,
        title: x.title.slice(0, 30),
        publishedAt: x.publishedAt,
    })),
);
// Should show 3 entries with non-empty slug/title/publishedAt.

// Trigger sort change.
c.sortMode = "oldest";
// Cards should visually reorder. URL should now have ?sort=oldest.

c.sortMode = "az";
// Cards reorder alphabetically. URL ?sort=az.

c.sortMode = "newest";
// Cards return to original order. URL drops the sort param.
```

Reload `http://localhost:2368/events/?sort=oldest`. Cards should appear oldest-first on initial paint.

-   [ ] **Step 4: Commit**

```
git add assets/js/post-filter-list.js
git commit -m "feat(filter): add client-side sort with URL sync"
```

---

## Task 4: Sort dropdown UI

**Files:**

-   Modify: `partials/post-filter-list.hbs:11-39` (region just inside the root div, above the chips block)

Add a toolbar row above the chips containing a native `<select>` bound to `sortMode`. Search input is added to the same toolbar in Task 8.

-   [ ] **Step 1: Insert the toolbar block in `partials/post-filter-list.hbs`**

Find the root `<div x-data="postFilterList(...)">` opening (line 7-10). Immediately after the opening `<div ...>` (line 10) and before the existing `{{!-- Filter chips: ... --}}` comment (line 12), insert:

```handlebars
{{! Toolbar: sort dropdown (and search input — added in Task 8). }}
<div
    x-cloak
    class="post-filter-toolbar container m-auto px-4 mb-4 flex flex-wrap gap-3 items-center justify-end"
>
    <div class="flex items-center gap-2">
        <label
            for="post-sort-{{collection}}"
            class="text-base text-gray-700"
        >Sort:</label>
        <select
            id="post-sort-{{collection}}"
            x-model="sortMode"
            class="px-3 py-2 rounded border border-gray-300 text-base"
        >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="az">Title A → Z</option>
            <option value="za">Title Z → A</option>
        </select>
    </div>
</div>
```

Notes:

-   `x-cloak` hides the toolbar until Alpine inits (otherwise the dropdown would briefly show a stale value during URL-seeded loads).
-   `justify-end` right-aligns the dropdown for now. Task 8 will change this to `justify-between` once the search input occupies the left side.

-   [ ] **Step 2: Build and lint**

```
npx gulp build
npm run test
```

-   [ ] **Step 3: Manually verify in browser**

Reload `http://localhost:2368/events/`. The sort dropdown should appear above the chip row, right-aligned. Changing it should reorder the cards. Reload `?sort=az` should pre-select "Title A → Z" and show alphabetical order.

Same on `http://localhost:2368/interviews/`.

-   [ ] **Step 4: Commit**

```
git add partials/post-filter-list.hbs
git commit -m "feat(filter): add sort dropdown to toolbar"
```

---

## Task 5: Create `assets/js/typesense-search.js` wrapper

**Files:**

-   Create: `assets/js/typesense-search.js`

Self-contained module. Three constants at the top (host, key, collection), one exported function. No state. The Alpine component will own the AbortController; this module just accepts the signal and passes it to `fetch`.

-   [ ] **Step 1: Create `assets/js/typesense-search.js`**

```javascript
// Wrapper around Typesense's search REST API for the post-filter-list component.
//
// The TYPESENSE_API_KEY below is a *search-only* key — Typesense's analogue of
// Ghost's Content API key. It is read-only and scoped to the `ghost` collection.
// Embedding it client-side is intentional and safe (Typesense convention).
//
// Schema verified live on 2026-05-06: collection holds 283 documents with
// fields title, slug, excerpt, plaintext, tags.slug, published_at, etc.

const TYPESENSE_HOST = "https://typesense.advisory.sg";
const TYPESENSE_API_KEY = "LWQ1uyADTZBRVJa0XuFY5BcipgnhvQ8g";
const TYPESENSE_COLLECTION = "ghost";

// Fields and weights — see spec.
const QUERY_BY = "title,excerpt,plaintext";
const QUERY_BY_WEIGHTS = "4,2,1";
const PER_PAGE = 250;

/**
 * Search the `ghost` collection and return matching post slugs.
 *
 * @param {string} query - Trimmed user query. Caller must ensure length >= 2.
 * @param {string[]} tagSlugs - Tag slugs scoping the search (the page's collection tags).
 *                              If empty, no filter_by is sent.
 * @param {AbortSignal} [signal] - Aborts the request if the caller's controller fires.
 * @returns {Promise<Set<string>>} Resolves with the set of matching post slugs.
 * @throws {Error} on network failure, non-2xx response, or malformed JSON.
 *                 AbortError is propagated as-is so callers can distinguish.
 */
export async function searchSlugs(query, tagSlugs, signal) {
    const params = new URLSearchParams({
        q: query,
        query_by: QUERY_BY,
        query_by_weights: QUERY_BY_WEIGHTS,
        include_fields: "slug",
        per_page: String(PER_PAGE),
    });
    if (tagSlugs && tagSlugs.length > 0) {
        params.set("filter_by", `tags.slug:[${tagSlugs.join(",")}]`);
    }

    const url = `${TYPESENSE_HOST}/collections/${TYPESENSE_COLLECTION}/documents/search?${params.toString()}`;
    const response = await fetch(url, {
        headers: { "X-TYPESENSE-API-KEY": TYPESENSE_API_KEY },
        signal,
    });
    if (!response.ok) {
        throw new Error(`Typesense HTTP ${response.status}`);
    }
    const data = await response.json();
    const slugs = (data.hits || []).map((h) => h.document.slug);
    return new Set(slugs);
}
```

-   [ ] **Step 2: Build and lint**

```
npx gulp build
npm run test
```

The build should bundle the new file into `assets/built/main.js` only once it's imported (Task 7). For now it just compiles standalone via webpack's module resolution.

-   [ ] **Step 3: Manually verify in browser (DevTools console)**

Open `http://localhost:2368/events/`. Open DevTools → Console. Paste a one-off probe (the function isn't yet imported anywhere, so we test via direct fetch using the same shape):

```javascript
fetch(
    "https://typesense.advisory.sg/collections/ghost/documents/search?q=stoic&query_by=title,excerpt,plaintext&query_by_weights=4,2,1&include_fields=slug&per_page=250",
    {
        headers: { "X-TYPESENSE-API-KEY": "LWQ1uyADTZBRVJa0XuFY5BcipgnhvQ8g" },
    },
)
    .then((r) => r.json())
    .then((d) =>
        console.log(
            "found",
            d.found,
            "sample slugs:",
            d.hits.slice(0, 3).map((h) => h.document.slug),
        ),
    );
```

Expected: a `found` count and 0-3 slug strings logged. CORS preflight must succeed; if it fails, Typesense host's CORS config is the issue (operational, fix outside this plan).

-   [ ] **Step 4: Commit**

```
git add assets/js/typesense-search.js
git commit -m "feat(search): add Typesense search wrapper"
```

---

## Task 6: Thread `tagSlugs` from page templates into the partial and component

**Files:**

-   Modify: `partials/post-filter-list.hbs:7-10` (root `<div>` `x-data` attribute)
-   Modify: `events.hbs` (the `{{> post-filter-list ...}}` call)
-   Modify: `interviews.hbs` (the `{{> post-filter-list ...}}` call)

The Typesense collection holds _all_ Ghost posts. To prevent search results bleeding across collections, every search request must carry `filter_by=tags.slug:[<page tags>]`. The slug list comes from `routes.yaml` and is duplicated into each page template as a `tagSlugs` parameter, then threaded through the partial into the Alpine component (which already accepts `tagSlugs` after Task 3).

-   [ ] **Step 1: Update `partials/post-filter-list.hbs` root to pass `tagSlugs` into Alpine**

Find lines 7-10 (currently):

```handlebars
<div
    id="post-filter-{{collection}}"
    x-data="postFilterList({ collection: '{{collection}}', mode: '{{mode}}' })"
    class="post-filter-list">
```

Replace with:

```handlebars
<div
    id="post-filter-{{collection}}"
    x-data="postFilterList({ collection: '{{collection}}', mode: '{{mode}}', tagSlugs: '{{tagSlugs}}' })"
    class="post-filter-list">
```

-   [ ] **Step 2: Update `events.hbs` partial call**

Find the line:

```handlebars
{{> post-filter-list collection="events" filter="tag:[hash-insights,hash-insights-2]" mode="or"}}
```

Replace with:

```handlebars
{{> post-filter-list collection="events" filter="tag:[hash-insights,hash-insights-2]" tagSlugs="hash-insights,hash-insights-2" mode="or"}}
```

-   [ ] **Step 3: Update `interviews.hbs` partial call**

Find the line:

```handlebars
{{> post-filter-list collection="interviews" filter="tag:[hash-conversations,hash-conversations-2,hash-conversations-3,hash-reflections,hash-reflections-2]" mode="or"}}
```

Replace with:

```handlebars
{{> post-filter-list collection="interviews" filter="tag:[hash-conversations,hash-conversations-2,hash-conversations-3,hash-reflections,hash-reflections-2]" tagSlugs="hash-conversations,hash-conversations-2,hash-conversations-3,hash-reflections,hash-reflections-2" mode="or"}}
```

(Yes, the slug list appears twice in each call — once for Ghost's `{{#get}}` filter expression, once as a plain comma-separated string for Typesense. Source of truth remains `routes.yaml`.)

-   [ ] **Step 4: Build and lint**

```
npx gulp build
npm run test
```

-   [ ] **Step 5: Manually verify in browser (DevTools console)**

Reload `http://localhost:2368/events/`. Console:

```javascript
const c = Alpine.$data(document.querySelector('[x-data^="postFilterList"]'));
console.log(c.tagSlugs);
// Should print: ['hash-insights', 'hash-insights-2']
```

Same on interviews — should print the 5-element array.

-   [ ] **Step 6: Commit**

```
git add partials/post-filter-list.hbs events.hbs interviews.hbs
git commit -m "feat(filter): thread page tagSlugs into Alpine component for search scoping"
```

---

## Task 7: Search state, debounced fetch, AbortController, integration into filter pipeline

**Files:**

-   Modify: `assets/js/post-filter-list.js` (add import; extend state, init, filtered, clearFilters; add `_runSearch`, `setSearchQuery`; extend URL state)

Wire the Typesense wrapper into the component. UI for the search input lands in Task 8 — for now the state is testable from the console.

-   [ ] **Step 1: Add the import at the top of `assets/js/post-filter-list.js`**

At the very top of the file, before the existing comment header, add:

```javascript
import { searchSlugs } from "./typesense-search.js";
```

-   [ ] **Step 2: Extend the returned state object**

Inside the `return { ... }` block, find the `--- state ---` section. After `tagSlugs: ...,` add:

```javascript
        searchQuery: '',
        searchSlugs: null, // null = no search active or query < 2 chars; Set = Typesense results
        searchError: false,
        isSearching: false,
        _searchAbortController: null,
        _searchDebounceTimer: null,
```

The two underscore-prefixed fields are non-reactive runtime handles (Alpine will still proxy them, but we never bind to them in templates). Keeping them on the component avoids module-level state.

-   [ ] **Step 3: Extend `init()` to seed search from URL and watch `searchQuery`**

Replace the existing `init()` body with:

```javascript
        init() {
            this.allCards = this._readCardsFromDom();
            this.availableTags = this._buildAvailableTags(this.allCards);

            const state = this._readStateFromUrl();
            this.selectedTags = state.tags;
            this.sortMode = state.sort;
            this.searchQuery = state.q;

            this.$watch('selectedTags', () => {
                this.visibleCount = PAGE_SIZE;
                this._writeStateToUrl();
            });
            this.$watch('sortMode', () => {
                this.visibleCount = PAGE_SIZE;
                this._reorderDom();
                this._writeStateToUrl();
            });

            // Apply initial DOM order if URL specified a non-default sort.
            if (this.sortMode !== 'newest') {
                this._reorderDom();
            }

            // Fire a search if URL had ?q=… on load.
            if (this.searchQuery.trim().length >= 2) {
                this._runSearch();
            }
        },
```

-   [ ] **Step 4: Update `filtered()` to apply the search filter**

Replace the existing `filtered()` body with:

```javascript
        filtered() {
            let result = this.allCards.filter((c) => this.matches(c));
            if (this.searchSlugs !== null) {
                result = result.filter((c) => this.searchSlugs.has(c.slug));
            }
            return this._sorted(result);
        },
```

-   [ ] **Step 5: Update `clearFilters()` to reset all state**

Replace the existing `clearFilters()` body with:

```javascript
        clearFilters() {
            this.selectedTags = [];
            this.sortMode = 'newest';
            this.searchQuery = '';
            this.searchSlugs = null;
            this.searchError = false;
        },
```

-   [ ] **Step 6: Add `setSearchQuery` and `_runSearch` to the component**

Inside the `--- actions ---` section, before `clearFilters`, add:

```javascript
        setSearchQuery(value) {
            this.searchQuery = value;
            clearTimeout(this._searchDebounceTimer);
            this._searchDebounceTimer = setTimeout(() => {
                this._runSearch();
            }, 250);
        },
```

Inside the `--- internals ---` section, after `_reorderDom()`, add:

```javascript
        async _runSearch() {
            const trimmed = this.searchQuery.trim();

            // Cancel any in-flight request — newer query supersedes it.
            if (this._searchAbortController) {
                this._searchAbortController.abort();
            }

            // Short-circuit: <2 chars means no search active.
            if (trimmed.length < 2) {
                this.searchSlugs = null;
                this.searchError = false;
                this.isSearching = false;
                this.visibleCount = PAGE_SIZE;
                this._writeStateToUrl();
                return;
            }

            this._searchAbortController = new AbortController();
            this.isSearching = true;

            try {
                const slugs = await searchSlugs(
                    trimmed,
                    this.tagSlugs,
                    this._searchAbortController.signal,
                );
                this.searchSlugs = slugs;
                this.searchError = false;
                this.visibleCount = PAGE_SIZE;
                this._writeStateToUrl();
            } catch (err) {
                if (err.name === 'AbortError') return; // newer query is in flight
                this.searchSlugs = null;
                this.searchError = true;
            } finally {
                this.isSearching = false;
            }
        },
```

-   [ ] **Step 7: Extend `_readStateFromUrl` and `_writeStateToUrl` to handle `q`**

Replace the existing `_readStateFromUrl` body with:

```javascript
        _readStateFromUrl() {
            const params = new URLSearchParams(window.location.search);

            const tags = (params.get('tags') || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);

            const rawSort = params.get('sort') || 'newest';
            const validSorts = ['newest', 'oldest', 'az', 'za'];
            const sort = validSorts.includes(rawSort) ? rawSort : 'newest';

            const q = params.get('q') || '';

            return { tags, sort, q };
        },
```

Replace the existing `_writeStateToUrl` body with:

```javascript
        _writeStateToUrl() {
            const params = new URLSearchParams(window.location.search);

            if (this.selectedTags.length) {
                params.set('tags', this.selectedTags.join(','));
            } else {
                params.delete('tags');
            }

            if (this.sortMode && this.sortMode !== 'newest') {
                params.set('sort', this.sortMode);
            } else {
                params.delete('sort');
            }

            const q = (this.searchQuery || '').trim();
            if (q.length >= 2) {
                params.set('q', q);
            } else {
                params.delete('q');
            }

            const qs = params.toString();
            const newUrl = qs
                ? `${window.location.pathname}?${qs}`
                : window.location.pathname;
            window.history.replaceState(null, '', newUrl);
        },
```

-   [ ] **Step 8: Build and lint**

```
npx gulp build
npm run test
```

-   [ ] **Step 9: Manually verify in browser (DevTools console)**

Reload `http://localhost:2368/events/`. Console:

```javascript
const c = Alpine.$data(document.querySelector('[x-data^="postFilterList"]'));

// Trigger a search programmatically (simulates UI input).
c.setSearchQuery("stoic");

// Wait ~500ms then inspect.
setTimeout(() => {
    console.log(
        "searchSlugs size:",
        c.searchSlugs?.size,
        "isSearching:",
        c.isSearching,
        "searchError:",
        c.searchError,
    );
    console.log("visible count:", c.visible().length);
    console.log("URL:", location.search);
}, 600);
```

Expected:

-   `searchSlugs` is a `Set` with 0+ entries.
-   `isSearching` is `false` (request completed).
-   `visible count` reflects the intersection of search results with loaded cards.
-   URL has `?q=stoic`.

Reload `http://localhost:2368/events/?q=banking`. Console — search should fire on init, narrow results.

Test the abort path:

```javascript
c.setSearchQuery("a"); // <2 chars → searchSlugs = null
c.setSearchQuery("ab"); // fires search
c.setSearchQuery("abc"); // aborts the prior, fires new
```

Network panel: only the latest request should complete; earlier ones show `cancelled` status.

Test error path: in DevTools → Network, right-click → Block request URL on the Typesense host. Then `c.setSearchQuery('test')`. Wait. `c.searchError` should become `true`. Unblock URL.

-   [ ] **Step 10: Commit**

```
git add assets/js/post-filter-list.js
git commit -m "feat(search): integrate Typesense search into filter pipeline"
```

---

## Task 8: Search input UI, searching indicator, error banner, empty-state copy, Clear-filters scope

**Files:**

-   Modify: `partials/post-filter-list.hbs` (toolbar block, chip-row Clear button, empty state, error banner)

Add the search input to the toolbar (left side, flex-1) alongside the existing sort dropdown (right side). Add a `Searching…` indicator. Add a Typesense-error banner. Adapt the empty-state copy to mention search. Extend the Clear-filters button visibility to also trigger when search or sort is active.

-   [ ] **Step 1: Replace the toolbar block in `partials/post-filter-list.hbs`**

Find the toolbar block added in Task 4:

```handlebars
{{! Toolbar: sort dropdown (and search input — added in Task 8). }}
<div
    x-cloak
    class="post-filter-toolbar container m-auto px-4 mb-4 flex flex-wrap gap-3 items-center justify-end"
>
    <div class="flex items-center gap-2">
        <label
            for="post-sort-{{collection}}"
            class="text-base text-gray-700"
        >Sort:</label>
        <select
            id="post-sort-{{collection}}"
            x-model="sortMode"
            class="px-3 py-2 rounded border border-gray-300 text-base"
        >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="az">Title A → Z</option>
            <option value="za">Title Z → A</option>
        </select>
    </div>
</div>
```

Replace with:

```handlebars
{{! Toolbar: search input (left, flex-1) + sort dropdown (right). }}
<div
    x-cloak
    class="post-filter-toolbar container m-auto px-4 mb-4 flex flex-wrap gap-3 items-center"
>
    <div class="flex-1 min-w-[200px] flex items-center gap-2">
        <label for="post-search-{{collection}}" class="sr-only">Search posts</label>
        <input
            id="post-search-{{collection}}"
            type="search"
            placeholder="Search posts..."
            :value="searchQuery"
            @input="setSearchQuery($event.target.value)"
            @keydown.escape="setSearchQuery(''); $event.target.focus()"
            aria-controls="post-grid-{{collection}}"
            class="flex-1 px-3 py-2 rounded border border-gray-300 text-base"
        />
        <span
            x-show="isSearching"
            aria-live="polite"
            class="text-base text-gray-600 whitespace-nowrap"
        >
            Searching…
        </span>
    </div>
    <div class="flex items-center gap-2">
        <label
            for="post-sort-{{collection}}"
            class="text-base text-gray-700"
        >Sort:</label>
        <select
            id="post-sort-{{collection}}"
            x-model="sortMode"
            class="px-3 py-2 rounded border border-gray-300 text-base"
        >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="az">Title A → Z</option>
            <option value="za">Title Z → A</option>
        </select>
    </div>
</div>

{{! Search error banner }}
<div
    x-cloak
    x-show="searchError"
    role="alert"
    class="container m-auto px-4 mb-4 p-3 rounded border bg-red-50 border-red-200 text-red-900 text-base"
>
    Search temporarily unavailable. Filters and sorting still work.
</div>
```

-   [ ] **Step 2: Extend the chip-row Clear-filters button visibility**

Find the existing chip-row Clear-filters button (currently inside the `filter-chips` div):

```handlebars
<button
    type="button"
    @click="clearFilters()"
    x-show="selectedTags.length > 0"
    class="px-4 py-2 rounded-full text-base text-gray-700 underline hover:text-gray-900"
>
    Clear filters
</button>
```

Replace the `x-show` attribute:

```handlebars
<button
    type="button"
    @click="clearFilters()"
    x-show="selectedTags.length > 0 || searchQuery.trim().length > 0 || sortMode !== 'newest'"
    class="px-4 py-2 rounded-full text-base text-gray-700 underline hover:text-gray-900"
>
    Clear filters
</button>
```

-   [ ] **Step 3: Adapt the empty-state copy**

Find the empty state block:

```handlebars
{{! Empty state }}
<div
    x-cloak
    x-show="filtered().length === 0"
    class="container m-auto px-4 py-12 text-center text-xl text-gray-700"
>
    <p>No posts match your selected tags.</p>
    <button
        type="button"
        @click="clearFilters()"
        x-show="selectedTags.length > 0"
        class="mt-4 px-4 py-2 rounded-full border border-gray-900 text-base hover:bg-gray-900 hover:text-white transition-colors"
    >
        Clear filters
    </button>
</div>
```

Replace the entire block with:

```handlebars
{{! Empty state }}
<div
    x-cloak
    x-show="filtered().length === 0"
    class="container m-auto px-4 py-12 text-center text-xl text-gray-700"
>
    <p x-show="searchQuery.trim().length > 0 && selectedTags.length > 0">No
        posts match your search and filters.</p>
    <p x-show="searchQuery.trim().length > 0 && selectedTags.length === 0">No
        posts match your search.</p>
    <p x-show="searchQuery.trim().length === 0 && selectedTags.length > 0">No
        posts match your selected tags.</p>
    <p x-show="searchQuery.trim().length === 0 && selectedTags.length === 0">No
        posts to show.</p>
    <button
        type="button"
        @click="clearFilters()"
        x-show="selectedTags.length > 0 || searchQuery.trim().length > 0 || sortMode !== 'newest'"
        class="mt-4 px-4 py-2 rounded-full border border-gray-900 text-base hover:bg-gray-900 hover:text-white transition-colors"
    >
        Clear filters
    </button>
</div>
```

-   [ ] **Step 4: Build and lint**

```
npx gulp build
npm run test
```

-   [ ] **Step 5: Manually verify in browser**

Reload `http://localhost:2368/events/`.

1. Toolbar shows search input (left, full-width) and sort dropdown (right).
2. Type a query — results live-narrow after ~250ms; "Searching…" appears briefly.
3. Combine with a tag chip — narrows further (intersection).
4. Clear search — full set returns.
5. Type a nonsense query like "asdfqwerzxcv" — empty state shows "No posts match your search." with Clear filters button.
6. Click Clear filters — search input empties, chips deselect, sort returns to Newest first.
7. Press Esc inside the search input — clears the input and refocuses it.
8. Reload `?q=banking&sort=oldest&tags=hash-insights` — all three apply correctly on initial paint.
9. (Mobile) Resize viewport to 375px — toolbar wraps: search above, sort below. Both still functional.
10. (Error path) DevTools → Network → block `typesense.advisory.sg`. Type a search. Red error banner appears: "Search temporarily unavailable…". Chips and sort still work. Unblock and clear search to dismiss banner.

Same checks on `/interviews/`.

-   [ ] **Step 6: Commit**

```
git add partials/post-filter-list.hbs
git commit -m "feat(search): add search input, indicator, banner, and empty-state adaptation"
```

---

## Task 9: End-to-end manual verification matrix

**Files:** none (verification only)

A final pass against the spec's testing checklist (section 12 of the spec). No code changes. Catch anything missed before handing back to the user.

-   [ ] **Step 1: Run the full matrix on `/events/`**

Walk through every scenario in `docs/superpowers/specs/2026-05-06-search-sort-fullload-design.md` § "Testing and verification":

1. ✅ Page loads → toolbar visible, chips visible, full event-post count present in DOM (`document.querySelectorAll('.filter-card-wrapper').length` matches expected).
2. ✅ Type "stoic" → live narrow, count updates, URL gets `?q=stoic`.
3. ✅ Click an interviews-related chip + search → AND-narrow.
4. ✅ Change sort to "Title A→Z" → cards visually reorder. URL has `sort=az`.
5. ✅ Refresh `/events/?q=banking&tags=hash-insights&sort=oldest` → all three pre-applied correctly on first paint.
6. ✅ Block Typesense host → banner appears on next search; chips and sort still work.
7. ✅ Type "x" (one char) → no Typesense request fires (verify in Network panel). Type "xy" → request fires.
8. ✅ Type fast (multiple chars rapidly) → in-flight requests get cancelled (`status: cancelled` in Network panel).
9. ✅ Disable JavaScript in DevTools → all posts visible in static grid; no toolbar; no chip UI.
10. ✅ Mobile viewport (375px) → toolbar wraps to two rows.
11. ✅ Tab through controls with keyboard. Tab order: search → sort → first chip → other chips → first card → load-more (if visible).
12. ✅ Esc inside search input clears + refocuses.
13. ✅ Clear filters button (in chip row AND in empty state) clears all four dimensions: tags, search, sort.

-   [ ] **Step 2: Run the same matrix on `/interviews/`**

Identical checks; substitute interview tag slugs.

-   [ ] **Step 3: Confirm `/posts/` is unaffected**

Load `http://localhost:2368/posts/`. Should show plain post grid, no toolbar, no chips, title "Posts". This template (`index.hbs`) shouldn't have changed.

-   [ ] **Step 4: Confirm tag pages are unaffected**

Load `http://localhost:2368/tag/<some-public-tag-slug>/`. Should show normal tag page, no filter UI. (Reads from `tag.hbs`, not touched.)

-   [ ] **Step 5: Run `gscan` one final time**

```
npm run test
```

Should pass with no errors.

-   [ ] **Step 6: Hand back to user**

Report:

-   Total commits added on this branch since the start of the plan.
-   Any scenario from the matrix that didn't behave as expected.
-   Any surprises or deviations from the spec that the implementer made.
-   Suggested next step (typically: invoke `superpowers:finishing-a-development-branch` for PR/merge).

---

## Self-review notes (writer's check)

**Spec coverage check:**

-   Full-corpus load (Approach A, 20 blocks, 2000 ceiling) → Task 1.
-   Sort options + UI + URL sync → Tasks 2, 3, 4.
-   Typesense search wrapper → Task 5.
-   `tagSlugs` plumbing for `filter_by` → Task 6.
-   Search state, debounce, AbortController, error handling → Task 7.
-   Search UI, searching indicator, error banner, empty-state copy, Clear-filters scope → Task 8.
-   Accessibility (sr-only label, aria-controls, aria-live, role=alert, native select) → Task 8.
-   All scenarios in spec § "Testing and verification" → Task 9.

**Type/name consistency check:**

-   `_readStateFromUrl` / `_writeStateToUrl` introduced in Task 3, extended in Task 7. Same names throughout.
-   `searchSlugs` (component state) vs `searchSlugs` (imported function from `typesense-search.js`) — same name, different scope. Module export is namespaced via `import { searchSlugs } from './typesense-search.js'` and called as `searchSlugs(...)` (function call), distinct from `this.searchSlugs` (property access). No actual collision but worth knowing.
-   `tagSlugs` parameter (string from partial) vs `tagSlugs` state (parsed array on the component) — same name, parsed in the component constructor. Confirmed in Task 3, Step 1 ("comma-separated string of tag slugs … Not consumed in Task 3" → parsed in `tagSlugs: (tagSlugs || '').split(',')...`).
-   `setSearchQuery` (Task 7 step 6) is called from the input handler in Task 8 step 1 (`@input="setSearchQuery($event.target.value)"`). Names match.
-   `data-published-at` (Task 2) → `inner.dataset.publishedAt` (Task 3, `_readCardsFromDom`). Camelcase auto-conversion is correct.
