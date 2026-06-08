# Sort & Filter (Events / Interviews) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-place, multi-tag, client-side filter to `/events/` and `/interviews/`, with URL-synced state, "Load more" pagination, and a configurable OR/AND mode.

**Architecture:** All matching posts are server-rendered into the page once via Ghost's `{{#get}}` helper. An Alpine.js component reads the post DOM, builds an available-tag list, watches a `selectedTags` array, and toggles `x-show` on each card to filter and paginate without re-fetching. Filter state syncs to `?tags=...` via `history.replaceState`.

**Tech Stack:** Ghost theme (Handlebars partials + `routes.yaml`), Alpine.js (already a dep), Tailwind CSS (already a dep), webpack via gulp (already configured). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-06-sort-filter-design.md`

## Working environment

-   Local Ghost instance at `http://localhost:2368` with this theme installed.
-   Build the theme one-shot: `npx gulp build` (compiles HBS, CSS, JS into `assets/built/`).
-   Watch mode for active dev: `npm run dev` (runs `gulp` default — build + livereload + watch). Leave it running in a separate terminal.
-   Theme linter: `npm run test` (runs `gscan .`). Must show no errors. CI form: `npm run test:ci`.
-   Pre-commit hook (husky + pretty-quick) runs Prettier on staged files. Don't fight it — let it reformat.
-   All tasks commit to the current branch (`filter-addition`).

## File map

**Created:**

-   `interviews.hbs` — page template for `/interviews/` (mirror of `index.hbs` using the new partial).
-   `partials/post-filter-list.hbs` — reusable filter UI + post grid + load-more.
-   `assets/js/post-filter-list.js` — Alpine component definition.

**Modified:**

-   `partials/post-card.hbs` — add `data-tags` and `data-tag-names` to root `<article>`.
-   `events.hbs` — swap tags-listing/foreach/pagination block for the new partial.
-   `assets/js/main.js` — import the component file and register before `Alpine.start()`.
-   `config/routes.yaml` — point `/interviews/` template at `interviews` instead of `index`.

**Untouched:**

-   `index.hbs` — still serves `/posts/` as a generic collection.
-   `partials/tags-listing.hbs` — left intact.
-   `tag.hbs` — left intact.

---

## Task 1: Add `data-tags` and `data-tag-names` to `post-card.hbs`

**Files:**

-   Modify: `partials/post-card.hbs:1`

This card partial is shared across many pages (homepage, related posts, listings, tag pages). Adding two extra `data-*` attributes is harmless everywhere else and is what the new filter component reads.

-   [ ] **Step 1: Edit the root `<article>` element**

Change line 1 of `partials/post-card.hbs` from:

```handlebars
<article class="feed-card {{post_class}} rounded-lg shadow-2xl m-auto w-full max-w-2xl md:max-w-full lg:h-full hover:shadow-md hover:border-opacity-0 transform hover:-translate-y-1 transition-all duration-200">
```

to:

```handlebars
<article
    class="feed-card {{post_class}} rounded-lg shadow-2xl m-auto w-full max-w-2xl md:max-w-full lg:h-full hover:shadow-md hover:border-opacity-0 transform hover:-translate-y-1 transition-all duration-200"
    data-tags="{{#foreach tags visibility="public"}}{{slug}}{{#unless @last}},{{/unless}}{{/foreach}}"
    data-tag-names="{{#foreach tags visibility="public"}}{{name}}{{#unless @last}},{{/unless}}{{/foreach}}">
```

The `visibility="public"` argument excludes Ghost's internal hash-prefixed routing tags (`#insights`, `#conversations`, etc.) so they don't surface as filter chips.

-   [ ] **Step 2: Build and lint**

Run:

```
npx gulp build
npm run test
```

Both should complete with no errors.

-   [ ] **Step 3: Manually verify in browser**

With `npm run dev` running and Ghost serving the theme, load `http://localhost:2368/events/` in a browser. Open DevTools, inspect any `.feed-card` element, and confirm both `data-tags="..."` and `data-tag-names="..."` are present. They should contain only public tag slugs/names (no `hash-...` entries).

-   [ ] **Step 4: Commit**

```
git add partials/post-card.hbs
git commit -m "feat(post-card): expose public tags via data attributes"
```

---

## Task 2: Add the Alpine component skeleton

**Files:**

-   Create: `assets/js/post-filter-list.js`
-   Modify: `assets/js/main.js:1-12`

Land the component file with all methods stubbed/empty so we can wire it into `main.js`, build, and verify Alpine doesn't error before adding logic.

-   [ ] **Step 1: Create `assets/js/post-filter-list.js`**

```javascript
// Alpine component for client-side multi-tag filter, load-more, and URL sync.
// Used by partials/post-filter-list.hbs on /events/ and /interviews/.
//
// Call site:
//   <div x-data="postFilterList({ collection: 'events', mode: 'or' })" ...>
export default function postFilterList({ collection, mode }) {
    const PAGE_SIZE = 12;

    return {
        selectedTags: [],
        visibleCount: PAGE_SIZE,
        allCards: [],
        availableTags: [],

        init() {
            this.allCards = this._readCardsFromDom();
            this.availableTags = this._buildAvailableTags();
            this.selectedTags = this._readTagsFromUrl();
            this.$watch("selectedTags", () => {
                this.visibleCount = PAGE_SIZE;
                this._writeTagsToUrl();
            });
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
            return this.allCards.filter((c) => this.matches(c));
        },

        visible() {
            return this.filtered().slice(0, this.visibleCount);
        },

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
        },

        // --- internals ---------------------------------------------------

        _readCardsFromDom() {
            const root = this.$root || this.$el;
            const cards = root.querySelectorAll("[data-tags]");
            return Array.from(cards).map((el) => {
                const slugs = (el.dataset.tags || "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                return { el, tagSlugs: new Set(slugs) };
            });
        },

        _buildAvailableTags() {
            const root = this.$root || this.$el;
            const cards = root.querySelectorAll("[data-tags]");
            const map = new Map();
            cards.forEach((el) => {
                const slugs = (el.dataset.tags || "").split(",");
                const names = (el.dataset.tagNames || "").split(",");
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

        _readTagsFromUrl() {
            const params = new URLSearchParams(window.location.search);
            const raw = params.get("tags") || "";
            return raw
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
        },

        _writeTagsToUrl() {
            const params = new URLSearchParams(window.location.search);
            if (this.selectedTags.length) {
                params.set("tags", this.selectedTags.join(","));
            } else {
                params.delete("tags");
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

-   [ ] **Step 2: Wire it into `main.js`**

Modify the top of `assets/js/main.js`. Find:

```javascript
import "./jquery-global.js";

import InfiniteScroll from "infinite-scroll";
import fitvids from "fitvids";
import "lazysizes";

import Glide from "@glidejs/glide";
import Alpine from "alpinejs";
import "flowbite";

window.Alpine = Alpine;
Alpine.start();
```

Replace with:

```javascript
import "./jquery-global.js";

import InfiniteScroll from "infinite-scroll";
import fitvids from "fitvids";
import "lazysizes";

import Glide from "@glidejs/glide";
import Alpine from "alpinejs";
import "flowbite";

import postFilterList from "./post-filter-list.js";

window.Alpine = Alpine;
Alpine.data("postFilterList", postFilterList);
Alpine.start();
```

Order matters: `Alpine.data(...)` must run before `Alpine.start()`.

-   [ ] **Step 3: Build**

Run:

```
npx gulp build
```

Should complete with no webpack errors.

-   [ ] **Step 4: Verify Alpine still works**

Reload `http://localhost:2368/events/` in a browser. Open DevTools console — there should be no Alpine errors. Other Alpine-driven widgets on the page (if any — flowbite uses Alpine) should still work normally.

-   [ ] **Step 5: Commit**

```
git add assets/js/post-filter-list.js assets/js/main.js
git commit -m "feat(js): add postFilterList Alpine component"
```

---

## Task 3: Create `partials/post-filter-list.hbs` and use it on `/events/`

**Files:**

-   Create: `partials/post-filter-list.hbs`
-   Modify: `events.hbs` (entire body)

Render the partial with full markup but no chip interaction yet — just the post grid via `{{#get}}`. This is the first user-visible step: `/events/` should look almost identical to before, with a chip row added above and a "Load more" button below.

-   [ ] **Step 1: Create the partial**

Create `partials/post-filter-list.hbs`:

```handlebars
{{!-- Reusable filter UI + post grid + load-more.
     Parameters:
       collection — string label (used as DOM id namespace)
       filter     — Ghost filter string passed to {{#get "posts"}}
       mode       — "or" (default) or "and" --}}

<div
    id="post-filter-{{collection}}"
    x-data="postFilterList({ collection: '{{collection}}', mode: '{{mode}}' })"
    x-cloak
    class="post-filter-list">

    {{!-- Filter chips (only visible if there are tags to filter by) --}}
    <div
        class="filter-chips container m-auto flex flex-wrap gap-2 mb-6 px-4"
        x-show="availableTags.length > 0">
        <template x-for="tag in availableTags" :key="tag.slug">
            <button
                type="button"
                role="checkbox"
                :aria-checked="isSelected(tag.slug)"
                @click="toggleTag(tag.slug)"
                :class="isSelected(tag.slug)
                    ? 'bg-brand-light text-gray-900 border-gray-900'
                    : 'bg-white text-gray-700 border-gray-300'"
                class="px-4 py-2 rounded-full border text-base hover:border-gray-900 transition-colors">
                <span x-text="tag.name"></span>
            </button>
        </template>
        <button
            type="button"
            @click="clearFilters()"
            x-show="selectedTags.length > 0"
            class="px-4 py-2 rounded-full text-base text-gray-700 underline hover:text-gray-900">
            Clear filters
        </button>
    </div>

    {{!-- Live result count for screen readers --}}
    <div role="status" aria-live="polite" class="container m-auto px-4 mb-4 text-lg text-gray-700">
        <span x-text="`Showing ${visible().length} of ${filtered().length}`"></span>
    </div>

    {{!-- Unknown-tags banner (URL referenced tags not on this page) --}}
    <div
        x-show="unknownTags().length > 0"
        class="container m-auto px-4 mb-4 p-3 rounded border bg-amber-50 border-amber-200 text-amber-900 text-base">
        The following tags don't exist on this page:
        <template x-for="(slug, i) in unknownTags()" :key="slug">
            <span><code x-text="slug"></code><span x-show="i < unknownTags().length - 1">, </span></span>
        </template>
    </div>

    {{!-- Empty state --}}
    <div
        x-show="filtered().length === 0"
        class="container m-auto px-4 py-12 text-center text-xl text-gray-700">
        <p>No posts match your selected tags.</p>
    </div>

    {{!-- Server-rendered post grid. Cards stay in DOM; Alpine toggles x-show. --}}
    <div class="post-feed container grid grid-cols-1 lg:grid-cols-3 gap-x-20 gap-y-10 m-auto">
        <!-- djlint:off -->
        {{#get "posts" limit="1000" filter=filter include="tags" order="published_at desc" as |posts|}}
        <!-- djlint:on -->
            {{#foreach posts}}
                <div x-show="isVisible($el.querySelector('[data-tags]'))" class="filter-card-wrapper">
                    {{> "post-card"}}
                </div>
            {{/foreach}}
        {{/get}}
    </div>

    {{!-- Load more button --}}
    <div class="container m-auto px-4 my-8 text-center" x-show="hasMore()">
        <button
            type="button"
            @click="loadMore()"
            class="px-6 py-3 rounded-full border border-gray-900 text-lg font-bold hover:bg-gray-900 hover:text-white transition-colors">
            Load more
        </button>
    </div>
</div>

<style>
    [x-cloak] { display: none !important; }
</style>
```

Note on `isVisible`: each card is wrapped in a `<div class="filter-card-wrapper">`, and the wrapper's `x-show` calls `isVisible()` against the inner `[data-tags]` element (the `<article>` produced by `post-card.hbs`).

-   [ ] **Step 2: Update `events.hbs` to use the partial**

Replace the entire contents of `events.hbs` with:

```handlebars
{{!< default}}

{{#contentFor "title"}}Events{{/contentFor}}

<div class="content-area">
    <main class="site-main">
        <header class="single-header kg-canvas">
            <h1 class="single-title">Events</h1>
        </header>
        {{> post-filter-list collection="events" filter="tag:hash-insights" mode="or"}}
    </main>
</div>
```

-   [ ] **Step 3: Build and lint**

Run:

```
npx gulp build
npm run test
```

Both should complete with no errors.

-   [ ] **Step 4: Manual verification at `localhost:2368/events/`**

In the browser:

-   The page should render with a row of pill chips at the top (one per tag found across event posts), a "Showing X of Y" line, and the same post grid as before. A "Load more" button appears below if there are more than 12 posts.
-   Click a chip — nothing should happen yet. Why: the `x-show` on each card uses `isVisible($el.querySelector('[data-tags]'))`, which depends on `visible()`, which depends on `selectedTags` and `visibleCount`. **It will work** as soon as `selectedTags` changes via `toggleTag` — but visually verify that the chips render and that the initial 12-card limit is enforced.
-   Verify in DevTools: every `.feed-card` `<article>` is wrapped in a `.filter-card-wrapper`, and only the first 12 wrappers are visible (the rest have `display: none` from Alpine's `x-show`).
-   Click a chip — the page should now filter to posts with that tag. Click again to deselect.
-   Click two chips — posts with **either** tag should show (OR mode default).
-   The URL should update to `?tags=...` as you click.

-   [ ] **Step 5: Commit**

```
git add partials/post-filter-list.hbs events.hbs
git commit -m "feat(events): add multi-tag filter and load-more"
```

---

## Task 4: Verify URL sync end-to-end

**Files:** None modified. This is a manual verification gate.

The Alpine component already implements URL sync (Task 2) and the partial is wired up (Task 3). This task confirms the end-to-end behavior matches the spec.

-   [ ] **Step 1: Filter from a clean URL**

-   Visit `http://localhost:2368/events/` (no query).
-   Click two chips. URL should become `http://localhost:2368/events/?tags=slug-1,slug-2` (with whatever slugs you picked).
-   Click one chip again to deselect. URL should drop that slug.
-   Click "Clear filters". URL should drop `?tags=` entirely (back to plain `/events/`).

-   [ ] **Step 2: Land on a pre-filtered URL**

-   Manually navigate to `http://localhost:2368/events/?tags=<a-real-slug>` in the address bar.
-   The page should load with that chip already selected and posts filtered.

-   [ ] **Step 3: Land on an unknown-tag URL**

-   Navigate to `http://localhost:2368/events/?tags=marine-biology-no-such-tag`.
-   Expected: amber banner listing `marine-biology-no-such-tag`, empty post grid, "Showing 0 of 0", and "Clear filters" button visible.
-   Click "Clear filters". Banner disappears, all posts return.

-   [ ] **Step 4: Land on a mixed URL (one valid, one unknown)**

-   Navigate to `http://localhost:2368/events/?tags=<a-real-slug>,nonexistent-slug`.
-   Expected: real-slug chip selected, posts filtered to that real tag, banner showing only `nonexistent-slug`.

-   [ ] **Step 5: Land on a malformed URL**

-   Navigate to `http://localhost:2368/events/?tags=,,,`.
-   Expected: no error, no filter applied, no banner (the empties are stripped).

-   [ ] **Step 6: Browser back/forward**

-   From `/events/`, click a chip → URL changes via `replaceState`.
-   Press browser Back. You should leave `/events/` entirely (not bounce between filter states), because we used `replaceState` not `pushState`. This is the intended behavior per the spec.

-   [ ] **Step 7: Commit (no code change — just a marker)**

If everything passes, no code changes are needed. Skip the commit. If something fails, debug and re-run this task before continuing.

---

## Task 5: Verify load-more behavior

**Files:** None modified. Another manual verification gate.

-   [ ] **Step 1: Initial state**

-   Visit `http://localhost:2368/events/`.
-   Verify exactly 12 posts are visible (or all of them if the collection has fewer than 12).
-   "Load more" button appears only if there are more than 12 matching posts.

-   [ ] **Step 2: Click "Load more"**

-   Click the button.
-   12 more posts become visible (or all remaining, whichever is smaller).
-   Counter updates: "Showing 24 of N" (or similar).
-   Button hides when all matches are visible.

-   [ ] **Step 3: Filter resets count**

-   After loading more (e.g. 24 visible of 30), click any chip.
-   Visible count should reset to 12 (of however many match the filter).
-   The `visibleCount = PAGE_SIZE` line in the `$watch('selectedTags')` callback drives this.

-   [ ] **Step 4: Focus moves on load-more**

-   Tab through the page using the keyboard until focus is on "Load more".
-   Press Enter or Space.
-   Focus should jump to the first newly-revealed card (the 13th overall, or the 13th match if a filter is applied). Verify by pressing Tab again — focus should move from card 13 onward, not from the start of the page.

-   [ ] **Step 5: Commit (no code change)**

If everything passes, skip the commit. If focus management or the count reset isn't working, re-read Task 2 step 1 (component code) and fix.

---

## Task 6: Add and manually verify the AND mode

**Files:**

-   Modify: `events.hbs` (one-character change for the duration of this task; will be reverted)

The component already handles `mode === 'and'` (Task 2 step 1). This task verifies it works end-to-end.

-   [ ] **Step 1: Switch the mode in `events.hbs`**

Change:

```handlebars
{{> post-filter-list collection="events" filter="tag:hash-insights" mode="or"}}
```

to:

```handlebars
{{> post-filter-list collection="events" filter="tag:hash-insights" mode="and"}}
```

-   [ ] **Step 2: Build**

```
npx gulp build
```

-   [ ] **Step 3: Manual verification**

-   Visit `http://localhost:2368/events/`.
-   Click one chip. Same posts as OR mode (single-tag selection behaves identically in both modes).
-   Click a second chip. Now only posts that have **both** selected tags should show. If no post has both, you should see the empty state ("No posts match your selected tags").
-   Deselect one chip. Filter relaxes to whatever the remaining chip alone matches.

-   [ ] **Step 4: Revert to OR**

Change the `mode="and"` back to `mode="or"`. Build again.

-   [ ] **Step 5: Commit (no code change since we reverted)**

If verification passed, skip. The `mode` parameter is now production-ready; production runs OR.

---

## Task 7: Add `interviews.hbs` and update `routes.yaml`

**Files:**

-   Create: `interviews.hbs`
-   Modify: `config/routes.yaml:10-13`

Now repeat the events setup for the interviews collection. Create a dedicated `interviews.hbs` template (so the filter UI does not bleed onto generic `/posts/` or other pages that share `index.hbs`).

-   [ ] **Step 1: Create `interviews.hbs`**

```handlebars
{{!< default}}

{{#contentFor "title"}}Interviews{{/contentFor}}

<div class="content-area">
    <main class="site-main">
        <header class="single-header kg-canvas">
            <h1 class="single-title">Interviews</h1>
        </header>
        {{> post-filter-list
            collection="interviews"
            filter="tag:[hash-conversations,hash-reflections]"
            mode="or"}}
    </main>
</div>
```

-   [ ] **Step 2: Update `config/routes.yaml`**

Find:

```yaml
/interviews/:
    permalink: /{year}/{month}/{day}/{slug}/
    template: index
    filter: tag:[hash-conversations,hash-reflections]
```

Change `template: index` to `template: interviews`:

```yaml
/interviews/:
    permalink: /{year}/{month}/{day}/{slug}/
    template: interviews
    filter: tag:[hash-conversations,hash-reflections]
```

-   [ ] **Step 3: Reload routes in Ghost**

Ghost loads `routes.yaml` from the active theme. If it doesn't pick up the change automatically, in the Ghost admin (`http://localhost:2368/ghost/`) go to **Settings → Labs → Routes**, download/upload the routes file, or restart Ghost. (Locally, restarting Ghost is the simplest reliable option.)

-   [ ] **Step 4: Build and lint**

```
npx gulp build
npm run test
```

-   [ ] **Step 5: Manual verification**

-   Visit `http://localhost:2368/interviews/`. Verify chips appear, filtering works, load-more works, URL sync works (same scenarios as Tasks 4–5 but on interviews).
-   Visit `http://localhost:2368/posts/` (the generic collection that still uses `index.hbs`). Verify **no filter UI** appears here.
-   Visit `http://localhost:2368/tag/<some-public-tag>/`. Verify **no filter UI** appears here either (still uses `tag.hbs`).

-   [ ] **Step 6: Commit**

```
git add interviews.hbs config/routes.yaml
git commit -m "feat(interviews): add filter using shared partial"
```

---

## Task 8: Add canonical link to event/interview templates

**Files:**

-   Modify: `events.hbs`, `interviews.hbs` (only if `{{ghost_head}}` does not already emit a canonical)

Filtered URLs (`?tags=...`) are content variants of the canonical pages. Canonical link tags tell search engines to dedupe.

-   [ ] **Step 1: Check what `{{ghost_head}}` emits**

Visit `http://localhost:2368/events/?tags=test` and view source. Look in `<head>` for an existing `<link rel="canonical" ...>` tag.

-   If a canonical tag is present and points to `/events/` (without `?tags=`): you're done. Skip to Step 3.
-   If no canonical, or it points to the filtered URL: proceed to Step 2.

-   [ ] **Step 2: Add canonical to both templates**

Add this inside the `{{#contentFor "title"}}...{{/contentFor}}` blocks, or as a separate `contentFor "head"` block if `default.hbs` supports it. If it doesn't, add directly inside the body of the template — browsers and crawlers also accept it inside `<body>` though `<head>` is preferred.

In `events.hbs`, after the `{{#contentFor "title"}}` line:

```handlebars
{{#contentFor "head"}}
    <link rel="canonical" href="{{@site.url}}/events/" />
{{/contentFor}}
```

In `interviews.hbs`, similarly:

```handlebars
{{#contentFor "head"}}
    <link rel="canonical" href="{{@site.url}}/interviews/" />
{{/contentFor}}
```

Then check `default.hbs` — if it does not have `{{{block "head"}}}` inside `<head>`, add it just before `{{ghost_head}}`:

```handlebars
{{{block "head"}}}
{{ghost_head}}
```

-   [ ] **Step 3: Build and verify**

```
npx gulp build
```

Visit `http://localhost:2368/events/?tags=test` and view source. Confirm a single canonical pointing to `/events/` (not `/events/?tags=test`).

-   [ ] **Step 4: Commit (only if you made changes)**

```
git add events.hbs interviews.hbs default.hbs
git commit -m "seo: canonicalize filtered events/interviews URLs"
```

---

## Task 9: Accessibility manual verification

**Files:** None modified, unless issues are found.

The component already includes `role="checkbox"`, `aria-checked`, `aria-live`, and focus management. This task spot-checks them.

-   [ ] **Step 1: Keyboard tab order**

-   Visit `http://localhost:2368/events/`.
-   From the address bar, press Tab until focus enters the chip row.
-   Verify each chip is reachable and visible focus indicator appears.
-   Press Space on a chip — it should toggle, posts should filter, screen reader (if available) should announce the new "Showing X of Y" count via the `aria-live` region.

-   [ ] **Step 2: Screen reader spot check (optional, if available)**

-   Enable VoiceOver (macOS), NVDA (Windows), or Orca (Linux).
-   Tab to a chip — should announce "checkbox, not checked" (or similar).
-   Activate it — should announce the updated result count.

-   [ ] **Step 3: Contrast and visual focus**

-   Tab through chips. Each focused chip should have a visible focus ring (browser default is fine; Tailwind doesn't strip it unless explicitly told to).
-   Selected vs unselected chips should differ in **more than just color** (we use background + border change + a checkmark concept via `aria-checked` styling). If selected chips look indistinguishable to the eye, add a checkmark icon: edit the chip `<button>` in `post-filter-list.hbs` to include an `<svg>` shown only when `isSelected(tag.slug)`.

-   [ ] **Step 4: Commit (only if you made styling changes)**

If you added the checkmark icon or fixed contrast:

```
git add partials/post-filter-list.hbs
git commit -m "a11y(filter): improve selected-chip visual distinction"
```

---

## Task 10: JS-disabled graceful degradation check

**Files:** None modified.

-   [ ] **Step 1: Disable JavaScript**

In Chrome DevTools: open Settings (F1) → Debugger → "Disable JavaScript". Or use the Command Menu (Ctrl/Cmd+Shift+P) → "Disable JavaScript".

-   [ ] **Step 2: Reload `/events/`**

-   Posts should still be visible (server-rendered).
-   Filter chips might be visible but won't respond — acceptable.
-   The `[x-cloak]` style hides the entire `post-filter-list` div until Alpine initializes, which means with JS disabled, **the whole filter region (chips + grid) is hidden**. This is a bug for the no-JS path.

-   [ ] **Step 3: Fix the cloak-hides-everything issue**

Move `[x-cloak]` so it hides only the chip row and counter — not the post grid. Edit `partials/post-filter-list.hbs`:

-   Remove `x-cloak` from the root `<div>`.
-   Add `x-cloak` to the `.filter-chips` div, the `aria-live` counter div, the unknown-tags banner, the empty-state div, and the load-more div — but NOT the `.post-feed` grid.

After change, the no-JS user sees: header, post grid (all matching posts, no pagination), no filter UI. Acceptable graceful degradation.

-   [ ] **Step 4: Re-enable JS, build, and verify**

Re-enable JS in DevTools. Run `npx gulp build`. Reload `/events/`. Filter UI should work as before.

-   [ ] **Step 5: Disable JS again, reload — confirm graceful degradation**

Posts should be visible without filter UI. Re-enable JS afterward.

-   [ ] **Step 6: Commit**

```
git add partials/post-filter-list.hbs
git commit -m "fix(filter): degrade gracefully when JS is disabled"
```

---

## Task 11: Mobile / narrow viewport check

**Files:** None modified, unless issues are found.

-   [ ] **Step 1: Test responsive layout**

In Chrome DevTools, toggle device toolbar (Ctrl/Cmd+Shift+M). Set viewport to 375px wide (iPhone SE).

-   [ ] **Step 2: Verify chip row wraps**

-   Chips should wrap to multiple rows (Tailwind `flex-wrap` already in the partial markup).
-   Counter and load-more button stack centered.
-   No horizontal scroll on the page.

-   [ ] **Step 3: Verify chips are tap-friendly**

-   Each chip should be at least 44x44 pixels tap target. The current `px-4 py-2 text-base` should produce ~40px height. If it's too small, bump padding to `px-4 py-3`.

-   [ ] **Step 4: Commit (only if you made styling changes)**

```
git add partials/post-filter-list.hbs
git commit -m "style(filter): adjust mobile chip sizing"
```

---

## Task 12: Final regression sweep and PR-ready commit

**Files:** None modified. End-to-end verification.

-   [ ] **Step 1: Build clean**

```
npx gulp build
npm run test
```

Both must pass with no errors.

-   [ ] **Step 2: Run through every spec scenario**

Tick through every row in the spec's "Testing" table:

| #   | Page                        | Action                 | Expected                                 |
| --- | --------------------------- | ---------------------- | ---------------------------------------- |
| 1   | /events/                    | No filter              | All event posts visible (12 + load more) |
| 2   | /events/                    | Single chip            | Filter to that tag                       |
| 3   | /events/                    | Two chips (OR)         | Posts matching either                    |
| 4   | /events/                    | Deselect chip          | Filter relaxes                           |
| 5   | /events/                    | Clear filters          | All chips off, URL clean                 |
| 6   | /events/                    | Load more              | Next 12 visible                          |
| 7   | /events/                    | Filter after load-more | Count resets to 12                       |
| 8   | /events/?tags=valid         | URL preload            | Pre-filtered                             |
| 9   | /events/?tags=invalid       | URL preload            | Empty + amber banner                     |
| 10  | /events/?tags=valid,invalid | URL preload            | Filtered + banner for invalid            |
| 11  | /events/?tags=,,,           | URL preload            | No filter, no error                      |
| 12  | /interviews/                | All scenarios 1–11     | Same behavior                            |
| 13  | /posts/                     | Visit                  | No filter UI                             |
| 14  | /tag/&lt;slug&gt;/          | Visit                  | No filter UI                             |
| 15  | /events/                    | JS disabled            | Posts visible, no filter UI              |
| 16  | /events/                    | Keyboard tab/space     | Chips toggle, aria-live announces        |
| 17  | /events/                    | Mobile viewport        | Chips wrap, no horizontal scroll         |
| 18  | /events/                    | mode="and" temporarily | Two chips → AND match                    |

-   [ ] **Step 3: Verify git log is clean**

```
git log --oneline filter-addition ^main
```

You should see roughly 5–8 small, focused commits since branching from main. If any commits are noise (e.g. typo fixes), consider squashing them into the relevant feature commit. Do not force-push to a shared branch without confirming with the user.

-   [ ] **Step 4: Hand off**

The branch is ready for code review / PR. Do not open the PR automatically — let the user do that, or ask them whether to.

---

## Out of scope (not in this plan)

These are explicitly **not** implemented here. They are listed so a reviewer doesn't ask "where's X":

-   Sort dropdown (date is fixed newest-first per spec).
-   Author / year filters.
-   Filter on `/posts/`, tag pages, or author pages.
-   Analytics events on filter changes.
-   Unit tests for the Alpine component (no test framework in this repo).
-   Server-side filter routing variants in `routes.yaml`.
-   Suggested-articles improvements (Feature 2 — separate spec to come).
