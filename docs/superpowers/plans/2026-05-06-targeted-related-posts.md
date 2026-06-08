# Targeted Related Posts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bottom-of-article "You might also like…" widget's "any shared tag" matching with content-relevance ranking from Typesense, while keeping today's tag-match SSR rendering as both the no-JS fallback and a topup pool when Typesense returns < 3 hits.

**Architecture:** Progressive enhancement on top of the existing `partials/related.hbs`. The current SSR `{{#get}}` block stays — those 3 cards land in the DOM at first paint and are the no-JS baseline. An Alpine.js component on the wrapper reads the current post's title + excerpt from `data-*` attributes, fires one Typesense REST call (`searchSimilar`), and on response either swaps in Typesense-ranked cards or tops up the SSR cards with hits not already present. Cross-collection scope. 3-card layout preserved.

**Tech Stack:** Ghost theme (Handlebars partials), Alpine.js (already a dep), Tailwind CSS (already a dep), webpack via gulp (already configured). New external: Typesense REST endpoint at `typesense.advisory.sg`. New deps: none.

**Spec:** `docs/superpowers/specs/2026-05-06-targeted-related-posts-design.md`

## Working environment

-   Local Ghost instance at `http://localhost:2368` with this theme installed.
-   Build: `npx gulp build` (compiles HBS, CSS, JS into `assets/built/`).
-   Watch mode for active dev: `npm run dev` (build + livereload + watch). Leave it running in a separate terminal.
-   Lint: `npm run test` (`gscan .`). Pre-existing baseline: 1 error (`page.hbs` page features) + 1 warning (`card_assets`). Tolerate those, flag any NEW errors.
-   Pre-commit hook (husky + pretty-quick) runs Prettier on staged files. Don't fight it — let it reformat.
-   All tasks commit to the current branch (`suggested-articles-improvements`).
-   Typesense schema verified live on 2026-05-06: collection `ghost`, 283 documents. Indexed fields include `id`, `title`, `slug`, `excerpt`, `plaintext`, `feature_image`, `url`, `tags` (array of names), `tags.name`, `tags.slug`, `published_at` (Unix ms).

## File map

**Created:**

-   `assets/js/typesense-search.js` — wrapper exporting `searchSimilar(query, options): Promise<Hit[]>`. ~60 lines.
-   `assets/js/related-posts.js` — Alpine component: orchestrate fetch, dedupe, swap, build cards. ~140 lines.

**Modified:**

-   `partials/related.hbs` — wrap existing content in `<section x-data="relatedPosts" data-post-id=… data-post-title=… data-post-excerpt=…>`. Always render the wrapper (move the `{{#if related}}` gate so it only gates the inner `{{#foreach}}`).
-   `partials/post-card.hbs` — add `data-slug="{{slug}}"` to the root `<article>` element.
-   `assets/js/main.js` — `import relatedPosts from './related-posts.js';` and `Alpine.data('relatedPosts', relatedPosts);` before `Alpine.start()`.
-   `default.hbs` — add `<script>window.__TYPESENSE_CONFIG__ = {...}</script>` block that injects `{{@custom.typesense_*}}`.
-   `package.json` — add three `config.custom` fields: `typesense_host`, `typesense_api_key`, `typesense_collection`.
-   `README.md` — add a "Typesense Search" section explaining the three settings.

**Untouched:**

-   `post.hbs` — already has `{{#if @custom.show_related_posts}}{{> related}}{{/if}}` doing the right gating.
-   `config/routes.yaml`, `tag.hbs`, listings — orthogonal.
-   CSS files — Tailwind utilities only, applied inline in the JS card builder.

**Note on cross-branch overlap:** `default.hbs`, `package.json`, `README.md`, and `assets/js/typesense-search.js` are also touched by the `filter-addition` branch (Feature 1). When the branches merge, expect trivial conflicts on these files — content is byte-identical or strictly additive.

---

## Task 1: Typesense config plumbing — package.json + default.hbs

**Files:**

-   Modify: `package.json` (`config.custom` block)
-   Modify: `default.hbs` (head section)

Three settings live under `config.custom` in `package.json` and become admin-overridable in **Ghost Admin → Design → Customize**. `default.hbs` injects the resolved values into a `window.__TYPESENSE_CONFIG__` global so the JS wrapper can read them at runtime. Defaults match the production Advisory SG instance.

-   [ ] **Step 1: Add three custom-config fields to `package.json`**

Find the `config.custom` block. After the existing `show_related_posts` field (which ends with `"group": "post"`), insert three new fields:

```json
            "show_related_posts": {
                "type": "boolean",
                "default": true,
                "group": "post"
            },
            "typesense_host": {
                "type": "text",
                "default": "https://typesense.advisory.sg"
            },
            "typesense_api_key": {
                "type": "text",
                "default": "LWQ1uyADTZBRVJa0XuFY5BcipgnhvQ8g"
            },
            "typesense_collection": {
                "type": "text",
                "default": "ghost"
            }
```

The three fields are intentionally ungrouped — Ghost recognises a fixed set of group names (`homepage`, `post`) and gscan flags unknown groups as a recommendation. The fields will appear at the bottom of the Customize panel without a group header.

-   [ ] **Step 2: Add the inline config script to `default.hbs`**

Find the existing `<script>` block in `<head>` that sets `var siteUrl`. Immediately AFTER that closing `</script>` and BEFORE `{{ghost_head}}`, insert:

```handlebars
{{! Typesense search config — sourced from package.json config.custom,
          overridable per-install in Ghost Admin → Design → Customize.
          The API key here is search-only (read-only, public-scoped). }}
<script>
    window.__TYPESENSE_CONFIG__ = { host: '{{@custom.typesense_host}}', apiKey:
    '{{@custom.typesense_api_key}}', collection: '{{@custom.typesense_collection}}',
    };
</script>
```

-   [ ] **Step 3: Build and lint**

```
npx gulp build
npm run test
```

Both should complete with no NEW errors. The pre-existing baseline (1 error in `page.hbs`, 1 warning in `package.json` about `card_assets`) is acceptable.

-   [ ] **Step 4: Commit**

```
git add package.json default.hbs
git commit -m "feat(config): add Typesense config to package.json + default.hbs"
```

---

## Task 2: Create `assets/js/typesense-search.js` wrapper

**Files:**

-   Create: `assets/js/typesense-search.js`

Self-contained ES module exporting one async function `searchSimilar(query, options)`. The function reads its host / API key / collection from `window.__TYPESENSE_CONFIG__` (set in Task 1) at search time, with the same defaults baked in as fallback for partial-page-render contexts.

The function returns rich hit data (title, excerpt, slug, feature_image, url, tags.name, tags.slug, published_at) — different from the search-bar variant on the other branch which only needs slugs. When that branch's `searchSlugs` function lands here on merge, it'll be a sibling export.

-   [ ] **Step 1: Create `assets/js/typesense-search.js`**

```javascript
// Wrapper around Typesense's search REST API.
//
// Configuration source of truth is `package.json` under `config.custom.typesense_*`,
// admin-overridable in Ghost → Design → Customize. `default.hbs` injects the
// resolved values into `window.__TYPESENSE_CONFIG__` before this bundle loads.
//
// The API key is a *search-only* key — Typesense's analogue of Ghost's Content
// API key. It is read-only and scoped to the configured collection. Embedding
// it client-side is intentional and safe (Typesense convention).

const DEFAULTS = {
    host: "https://typesense.advisory.sg",
    apiKey: "LWQ1uyADTZBRVJa0XuFY5BcipgnhvQ8g",
    collection: "ghost",
};

function getConfig() {
    const cfg =
        (typeof window !== "undefined" && window.__TYPESENSE_CONFIG__) || {};
    return {
        host: cfg.host || DEFAULTS.host,
        apiKey: cfg.apiKey || DEFAULTS.apiKey,
        collection: cfg.collection || DEFAULTS.collection,
    };
}

// Fields the related-posts card builder needs. Keep in sync with the field
// list in assets/js/related-posts.js → buildCardElement().
const RELATED_INCLUDE_FIELDS =
    "slug,title,excerpt,feature_image,url,tags,tags.name,tags.slug,published_at";

// Title hits weighted highest, then excerpt, then plaintext.
const RELATED_QUERY_BY = "title,excerpt,plaintext";
const RELATED_QUERY_BY_WEIGHTS = "4,2,1";

/**
 * Find documents semantically similar to a free-text query (typically a
 * post's "title\nexcerpt"). Returns rich hit objects sufficient for
 * client-side card rendering.
 *
 * @param {string} query - Free-text query, expected to be already trimmed and
 *                         length-capped by the caller (see related-posts.js).
 * @param {object} options
 * @param {string} [options.excludeId] - Document id to exclude (e.g. the current post).
 * @param {number} [options.limit=3] - Max hits to return.
 * @param {AbortSignal} [options.signal] - Aborts the request.
 * @returns {Promise<object[]>} Array of hit documents (slug, title, excerpt,
 *                              feature_image, url, tags, tags.slug, published_at).
 *                              Empty array on zero hits.
 * @throws {Error} on network failure, non-2xx, or malformed JSON. AbortError
 *                 is propagated as-is so callers can distinguish.
 */
export async function searchSimilar(query, options = {}) {
    const { excludeId, limit = 3, signal } = options;
    const { host, apiKey, collection } = getConfig();

    const params = new URLSearchParams({
        q: query,
        query_by: RELATED_QUERY_BY,
        query_by_weights: RELATED_QUERY_BY_WEIGHTS,
        include_fields: RELATED_INCLUDE_FIELDS,
        per_page: String(limit),
    });
    if (excludeId) {
        params.set("filter_by", `id:!=${excludeId}`);
    }

    const url = `${host}/collections/${collection}/documents/search?${params.toString()}`;
    const response = await fetch(url, {
        headers: { "X-TYPESENSE-API-KEY": apiKey },
        signal,
    });
    if (!response.ok) {
        throw new Error(`Typesense HTTP ${response.status}`);
    }
    const data = await response.json();
    return (data.hits || []).map((h) => h.document);
}
```

-   [ ] **Step 2: Build and lint**

```
npx gulp build
npm run test
```

The build should bundle the new file into `assets/built/main.js` only once it's imported (Task 4). For now it just compiles standalone via webpack's module resolution.

-   [ ] **Step 3: Manually verify in browser (DevTools console)**

Load any page on `http://localhost:2368/`. Open DevTools → Console. Paste a one-off probe (the function isn't yet imported anywhere, so we test via direct fetch using the same URL shape):

```javascript
fetch(
    "https://typesense.advisory.sg/collections/ghost/documents/search?q=stoic&query_by=title,excerpt,plaintext&query_by_weights=4,2,1&include_fields=slug,title,excerpt,feature_image,url,tags,tags.name,tags.slug,published_at&per_page=3",
    {
        headers: { "X-TYPESENSE-API-KEY": "LWQ1uyADTZBRVJa0XuFY5BcipgnhvQ8g" },
    },
)
    .then((r) => r.json())
    .then((d) =>
        console.log(
            "found",
            d.found,
            "hits",
            d.hits.map((h) => ({
                slug: h.document.slug,
                title: h.document.title.slice(0, 40),
                feature_image: !!h.document.feature_image,
                primary_tag:
                    h.document["tags.slug"] &&
                    h.document["tags.slug"].find((s) => !s.startsWith("hash-")),
            })),
        ),
    );
```

Expected: `found: <some count>` and 0-3 hits with non-empty slug/title fields. The `primary_tag` field should be a non-hash slug (or undefined if all tags are routing tags).

-   [ ] **Step 4: Commit**

```
git add assets/js/typesense-search.js
git commit -m "feat(search): add Typesense searchSimilar wrapper"
```

---

## Task 3: Add `data-slug` to `partials/post-card.hbs`

**Files:**

-   Modify: `partials/post-card.hbs:1-4` (root `<article>` element)

The Alpine component (Task 4) needs to match SSR-rendered cards to Typesense hits by slug — both for deduplication (don't show the same card twice) and for reuse (don't rebuild a card from Typesense data when the SSR card already exists in DOM). One attribute on the root `<article>` is enough.

-   [ ] **Step 1: Edit the root `<article>` element**

Find lines 1-4 of `partials/post-card.hbs` (current state):

```handlebars
<article
    class="feed-card {{post_class}} rounded-lg shadow-2xl m-auto w-full max-w-2xl md:max-w-full lg:h-full hover:shadow-md hover:border-opacity-0 transform hover:-translate-y-1 transition-all duration-200">
    <div onclick="location.href='{{url}}'" class="flex flex-col cursor-pointer h-full rounded-xl overflow-hidden md:flex-row md:h-80 lg:flex-col lg:h-full">
```

Replace the opening `<article>` tag (the first two lines through the closing `>`) with:

```handlebars
<article
    class="feed-card {{post_class}} rounded-lg shadow-2xl m-auto w-full max-w-2xl md:max-w-full lg:h-full hover:shadow-md hover:border-opacity-0 transform hover:-translate-y-1 transition-all duration-200"
    data-slug="{{slug}}">
```

`{{slug}}` is single-brace (Handlebars HTML-escapes by default) — safe for any post slug since slugs are restricted to URL-safe characters by Ghost.

-   [ ] **Step 2: Build and lint**

```
npx gulp build
npm run test
```

-   [ ] **Step 3: Manually verify in browser**

Reload any page that renders `post-card.hbs` (e.g. `http://localhost:2368/`). Open DevTools, inspect any `.feed-card`, confirm `data-slug="<some-post-slug>"` is present.

-   [ ] **Step 4: Commit**

```
git add partials/post-card.hbs
git commit -m "feat(post-card): expose slug as data attribute for related-posts JS"
```

---

## Task 4: Create `assets/js/related-posts.js` Alpine component

**Files:**

-   Create: `assets/js/related-posts.js`

The orchestration component. ~140 lines total. Reads the source post's metadata from `data-*` attributes on its own root element, reads SSR cards via `[data-slug]` query, fires one Typesense `searchSimilar` call, then either replaces the SSR cards with Typesense-ranked cards (topping up from SSR if Typesense returned < 3) or leaves them untouched on failure / empty response / identical-set short-circuit.

Includes a `buildCardElement(hit)` helper that mirrors `partials/post-card.hbs` structure — see Task 3's data-slug change and the spec's "Card-building contract" section.

-   [ ] **Step 1: Create `assets/js/related-posts.js`**

```javascript
// Alpine component for the bottom-of-article "You might also like…" widget.
// Used by partials/related.hbs.
//
// Reads the source post's id, title, and excerpt from data-* attributes
// on its own root element ($el.dataset). Fires one Typesense searchSimilar
// call, then merges the response with the SSR cards already in the DOM:
//
//   - If Typesense returns 3 hits and they differ from the SSR slugs:
//     replace the grid contents with 3 cards (reusing SSR DOM where slug
//     matches, building new DOM via buildCardElement() otherwise).
//   - If Typesense returns 1-2 hits: render those, then top up from SSR
//     cards (skipping duplicates) until 3.
//   - If Typesense returns 0 / fails / aborts / matches the SSR set:
//     do nothing — SSR cards stay.
//
// IMPORTANT: buildCardElement() below mirrors partials/post-card.hbs.
// If post-card.hbs changes shape, mirror the change here too.

import { searchSimilar } from "./typesense-search.js";

const TARGET_COUNT = 3;
const QUERY_MAX_CHARS = 500; // keeps Typesense URL well under 8KB

export default function relatedPosts() {
    return {
        async init() {
            const root = this.$el;
            const grid = root.querySelector(".related-feed");
            if (!grid) return;

            const source = {
                id: root.dataset.postId || "",
                title: root.dataset.postTitle || "",
                excerpt: root.dataset.postExcerpt || "",
            };

            // Nothing to query with — leave SSR cards alone.
            if (!source.title && !source.excerpt) return;

            const ssrCards = Array.from(
                grid.querySelectorAll(".feed-card[data-slug]"),
            ).map((el) => ({ slug: el.dataset.slug, el }));

            const query = `${source.title}\n${source.excerpt}`
                .trim()
                .slice(0, QUERY_MAX_CHARS);

            let hits;
            try {
                hits = await searchSimilar(query, {
                    excludeId: source.id,
                    limit: TARGET_COUNT,
                });
            } catch (err) {
                if (err.name !== "AbortError") {
                    console.warn("related-posts: Typesense search failed", err);
                }
                return; // SSR cards stay
            }

            // Defensive: drop any hit matching the source post (in case
            // filter_by didn't work for some reason).
            hits = hits.filter((h) => h.slug !== source.id && h.slug);

            if (hits.length === 0) return; // SSR cards stay

            // Equal-set short-circuit (any order): skip DOM swap to avoid
            // a visible re-layout flash for the common case where the SSR
            // fallback already had the right posts.
            const hitSlugs = hits.map((h) => h.slug).sort();
            const ssrSlugs = ssrCards.map((c) => c.slug).sort();
            if (
                hitSlugs.length === ssrSlugs.length &&
                hitSlugs.every((s, i) => s === ssrSlugs[i])
            ) {
                return;
            }

            // Build the final card list: Typesense hits first (reusing SSR
            // DOM where slugs match), then top up with SSR cards not yet
            // included, until TARGET_COUNT.
            const finalEls = [];
            const usedSlugs = new Set();
            for (const hit of hits) {
                const ssr = ssrCards.find((c) => c.slug === hit.slug);
                finalEls.push(ssr ? ssr.el : buildCardElement(hit));
                usedSlugs.add(hit.slug);
            }
            for (const ssr of ssrCards) {
                if (finalEls.length >= TARGET_COUNT) break;
                if (!usedSlugs.has(ssr.slug)) {
                    finalEls.push(ssr.el);
                    usedSlugs.add(ssr.slug);
                }
            }

            grid.replaceChildren(...finalEls);
        },
    };
}

// IMPORTANT: this builder mirrors partials/post-card.hbs. Keep the structure
// (article > div.flex > optional img + div.grow > primary tag span + title +
// excerpt + date / stretch-link anchor) byte-equivalent (modulo data
// attributes specific to the filter feature, which related-posts doesn't
// need).
function buildCardElement(hit) {
    const article = document.createElement("article");
    article.className =
        "feed-card post rounded-lg shadow-2xl m-auto w-full max-w-2xl md:max-w-full lg:h-full hover:shadow-md hover:border-opacity-0 transform hover:-translate-y-1 transition-all duration-200";
    article.dataset.slug = hit.slug || "";

    const inner = document.createElement("div");
    inner.className =
        "flex flex-col cursor-pointer h-full rounded-xl overflow-hidden md:flex-row md:h-80 lg:flex-col lg:h-full";
    inner.setAttribute("onclick", `location.href='${hit.url || "#"}'`);

    if (hit.feature_image) {
        const img = document.createElement("img");
        img.className =
            "object-cover m-0 h-full md:aspect-[9/5] lg:h-auto lg:aspect-[15/8]";
        img.src = hit.feature_image;
        img.alt = hit.title || "";
        inner.appendChild(img);
    }

    const body = document.createElement("div");
    body.className = "grow bg-white px-3 pt-3 pb-5 relative";

    // Primary tag = first non-routing tag (routing tags start with "hash-").
    const primaryTag = pickPrimaryTag(hit);
    if (primaryTag) {
        const tagSpan = document.createElement("span");
        tagSpan.className = "single-meta-item single-meta-tag";
        const tagAnchor = document.createElement("a");
        tagAnchor.className = `post-tag post-tag-${primaryTag.slug} text-lg uppercase font-extrabold`;
        tagAnchor.href = `/tag/${primaryTag.slug}/`;
        tagAnchor.textContent = primaryTag.name;
        tagSpan.appendChild(tagAnchor);
        body.appendChild(tagSpan);
    } else {
        const noTag = document.createElement("span");
        noTag.className = "text-lg uppercase font-extrabold";
        noTag.textContent = "[No tag]";
        body.appendChild(noTag);
    }

    const titleEl = document.createElement("p");
    titleEl.className = "text-2xl font-bold my-2";
    titleEl.textContent = hit.title || "";
    body.appendChild(titleEl);

    const excerptEl = document.createElement("p");
    excerptEl.className = "text-xl my-1 line-clamp-4";
    excerptEl.textContent = hit.excerpt || "";
    body.appendChild(excerptEl);

    const spacer = document.createElement("div");
    spacer.className = "h-8";
    body.appendChild(spacer);

    const dateWrap = document.createElement("div");
    dateWrap.className = "text-xl absolute right-4 bottom-4";
    const clockIcon = document.createElement("i");
    clockIcon.className = "far fa-clock";
    dateWrap.appendChild(clockIcon);
    if (hit.published_at) {
        const date = new Date(hit.published_at);
        const timeEl = document.createElement("time");
        timeEl.dateTime = date.toISOString().split("T")[0];
        timeEl.textContent =
            " " +
            date.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
            });
        dateWrap.appendChild(timeEl);
    }
    body.appendChild(dateWrap);

    inner.appendChild(body);

    const stretchAnchor = document.createElement("a");
    stretchAnchor.href = hit.url || "#";
    const stretchSpan = document.createElement("span");
    stretchSpan.className = "stretch-link";
    stretchAnchor.appendChild(stretchSpan);
    inner.appendChild(stretchAnchor);

    article.appendChild(inner);
    return article;
}

// First non-hash-prefixed tag from the parallel tags.name / tags.slug arrays.
// Returns null if all tags are routing tags or arrays are missing/empty.
function pickPrimaryTag(hit) {
    const names = hit["tags.name"] || hit.tags || [];
    const slugs = hit["tags.slug"] || [];
    for (let i = 0; i < slugs.length; i++) {
        if (slugs[i] && !slugs[i].startsWith("hash-")) {
            return { name: names[i] || slugs[i], slug: slugs[i] };
        }
    }
    return null;
}
```

-   [ ] **Step 2: Build and lint**

```
npx gulp build
npm run test
```

The bundle will now actually include `typesense-search.js` (it's imported here). Build should succeed.

-   [ ] **Step 3: Commit**

```
git add assets/js/related-posts.js
git commit -m "feat(related): add Alpine component with Typesense fetch + card builder"
```

---

## Task 5: Wrap `partials/related.hbs` with the Alpine component

**Files:**

-   Modify: `partials/related.hbs` (whole file replaced)

Wrap the existing `<section class="related-wrapper">` with `x-data="relatedPosts"`. Add `data-post-id`, `data-post-title`, `data-post-excerpt` so the JS can read the source post's metadata. Move the `{{#if related}}` gate so it only suppresses the inner `{{#foreach}}` — the wrapper itself always renders so the JS can populate it from Typesense even when SSR returns 0 cards (rare: post with no shared-tag matches).

-   [ ] **Step 1: Replace `partials/related.hbs` with the updated content**

Replace the entire file with:

```handlebars
{{!-- Bottom-of-article "You might also like…" widget.
     The SSR {{#get}} block below renders 3 tag-matched cards as the
     no-JS baseline AND as a topup pool for the JS-side Typesense
     enhancement (see assets/js/related-posts.js). --}}
<section
    class="related-wrapper"
    x-data="relatedPosts"
    data-post-id="{{post.id}}"
    data-post-title="{{post.title}}"
    data-post-excerpt="{{post.excerpt}}">
    <div class="container large">
        <h3 class="related-title">You might also like...</h3>
        <div class="related-feed grid grid-cols-1 lg:grid-cols-3 gap-x-20 gap-y-10 m-auto">
            {{!-- SSR baseline: same query as before. The {{#if related}}
                 gate is intentionally INSIDE so the wrapper always renders;
                 the JS may populate from Typesense even when SSR returns 0. --}}
            <!-- djlint:off -->
            {{#get "posts" limit="3" filter="tags:[{{post.tags}}]+id:-{{post.id}}" include="tags" as |related|}}
            <!-- djlint:on -->
                {{#if related}}
                    {{#foreach related}}
                        {{> "post-card"}}
                    {{/foreach}}
                {{/if}}
            {{/get}}
        </div>
    </div>
</section>
```

Notes:

-   The `<section>` is now the Alpine root — `$el.dataset.postId` etc. read off it.
-   `data-post-title` and `data-post-excerpt` use Handlebars HTML-attribute escaping (handles quotes, ampersands, etc. correctly — safer than a `<script type="application/json">` block which would need custom JSON-quote escaping for titles containing `"`).
-   The grid keeps the `related-feed` class so JS can find it.

-   [ ] **Step 2: Build and lint**

```
npx gulp build
npm run test
```

-   [ ] **Step 3: Commit**

```
git add partials/related.hbs
git commit -m "feat(related): wrap with Alpine component, source data on data-attrs"
```

---

## Task 6: Register the Alpine component in `assets/js/main.js`

**Files:**

-   Modify: `assets/js/main.js`

Add the import and `Alpine.data(...)` registration before `Alpine.start()` so the `x-data="relatedPosts"` binding in the partial resolves.

-   [ ] **Step 1: Read the current `main.js` to find the right insertion points**

Open `assets/js/main.js`. Look for:

-   The existing `import` block at the top.
-   The `Alpine.start()` call.

The component must be registered between Alpine being available (already imported) and `Alpine.start()` running.

-   [ ] **Step 2: Add the import**

Near the top of `main.js`, alongside the other imports, add:

```javascript
import relatedPosts from "./related-posts.js";
```

-   [ ] **Step 3: Register the component before `Alpine.start()`**

Find the line `Alpine.start();` (or equivalent — Alpine.start may be wrapped). Immediately BEFORE it, add:

```javascript
Alpine.data("relatedPosts", relatedPosts);
```

-   [ ] **Step 4: Build and lint**

```
npx gulp build
npm run test
```

The bundle should now wire the component to its DOM binding.

-   [ ] **Step 5: Manually verify in browser**

Reload any post page (e.g. `http://localhost:2368/<some-post-url>/`) where `@custom.show_related_posts` is true.

1. The "You might also like…" section appears with 3 cards (the SSR baseline).
2. Open DevTools → Network → filter for `typesense.advisory.sg`. One request fires shortly after page load.
3. Check Console for any errors. There should be none. A warning is acceptable only if Typesense is unreachable.
4. Inspect the `<section class="related-wrapper">`. It should have all three `data-post-*` attributes populated. Open Alpine DevTools (or run `Alpine.$data(document.querySelector('.related-wrapper'))` in console) — confirm the component initialized.
5. If Typesense returned different cards from the SSR set, the grid contents should be visibly different from the initial paint. (For pages where the SSR set was already optimal, no swap will occur.)

-   [ ] **Step 6: Commit**

```
git add assets/js/main.js
git commit -m "feat(related): register relatedPosts Alpine component"
```

---

## Task 7: Document Typesense in `README.md`

**Files:**

-   Modify: `README.md`

Add a new section explaining the three Typesense settings, the security model of the embedded API key, and where to override per-install.

-   [ ] **Step 1: Add the "Typesense Search" section**

Find the line `# PostCSS Features Used` near the bottom of `README.md`. Immediately BEFORE that heading, insert:

```markdown
# Typesense Search

The `/events/`, `/interviews/`, and bottom-of-article "you might also like" widget all use [Typesense](https://typesense.org/) for typo-tolerant, content-relevance search and ranking. Three settings live under `config.custom` in `package.json` and are admin-overridable in **Ghost Admin → Settings → Design → Customize**:

| Setting                | Default                         | What it is                                                         |
| ---------------------- | ------------------------------- | ------------------------------------------------------------------ |
| `typesense_host`       | `https://typesense.advisory.sg` | Typesense host URL (no trailing slash). HTTPS recommended.         |
| `typesense_api_key`    | (Advisory SG search-only key)   | Typesense **search-only** API key. Embedded client-side by design. |
| `typesense_collection` | `ghost`                         | Name of the indexed Ghost-posts collection on the Typesense host.  |

The flow is: `package.json` defaults → `default.hbs` injects them as `window.__TYPESENSE_CONFIG__` → `assets/js/typesense-search.js` reads from that global at search time, falling back to the same defaults if the global is missing.

**About the API key in source.** Typesense splits keys into _admin_ (read/write, secret) and _search-only_ (read-only, scoped to a collection). The search-only key is the analogue of Ghost's Content API key — it's designed to ship in client-side JavaScript and only grants read access to data that's already public. Don't paste an admin key here.

**Deploying to a different Ghost instance.** If your instance points at a different Typesense backend, override the three settings in **Design → Customize** rather than editing the theme. The defaults in `package.json` are only the fallback for installs that don't override.

**About the indexer.** This theme expects an existing Typesense collection populated with Ghost posts (`title`, `slug`, `excerpt`, `plaintext`, `feature_image`, `url`, `tags.name`, `tags.slug`, `published_at`, etc.). The sync mechanism (e.g. [MagicPages' Ghost-Typesense integration](https://github.com/magicpages/ghost-typesense)) is **not** part of this theme.
```

-   [ ] **Step 2: Commit**

(No build / lint needed for README-only changes.)

```
git add README.md
git commit -m "docs(readme): document Typesense search configuration"
```

---

## Task 8: End-to-end manual verification

**Files:** none (verification only)

A final pass against the spec's testing matrix (section "Testing and verification"). No code changes. Catch anything missed before handing back to the user.

-   [ ] **Step 1: Verify the SSR baseline (no-JS path)**

In DevTools, disable JavaScript (Settings → Debugger → Disable JavaScript, or per-tab via the Command Menu). Reload any post page where `@custom.show_related_posts` is true.

1. The "You might also like…" section appears with up to 3 cards from the existing tag-match query.
2. No console errors (none should be possible — JS is off).
3. Each card is a working link (anchor click navigates).

Re-enable JavaScript.

-   [ ] **Step 2: Verify the JS-enhanced path**

Reload the same post page with JS enabled.

1. Cards visible at first paint (the SSR baseline).
2. DevTools → Network: one request to `typesense.advisory.sg` fires within ~500ms of page load.
3. If Typesense returned different cards, the grid swaps once and stays. No flash beyond that one swap.
4. Inspect the new card DOM (if a swap occurred). Confirm structure matches a regular `post-card.hbs` render: `<article class="feed-card …">` with inner `<div>`, optional `<img>`, primary tag span, title `<p>`, excerpt `<p>`, time element, stretch-link anchor.

-   [ ] **Step 3: Verify cross-collection ranking**

Pick a post on a specific topic (e.g. an interview about venture capital). Reload. Among the related cards, look for cross-collection items (a VC event, a VC post in another collection). Compare to the SSR baseline (which would show only same-collection posts because of routing-tag overlap). The Typesense version should be more topically targeted.

-   [ ] **Step 4: Verify Typesense-failure path**

DevTools → Network → block request URL on `https://typesense.advisory.sg/*`. Reload a post page.

1. SSR cards remain visible (no JS swap).
2. Console shows a warning: `related-posts: Typesense search failed Error: …` (or similar).
3. No error banner visible to the user.

Unblock the URL.

-   [ ] **Step 5: Verify the `@custom.show_related_posts` toggle**

In Ghost Admin → Settings → Design → Customize, set `Show related posts` to **off**. Reload a post page.

1. The related section is absent from the page.
2. DevTools → Network: NO request to `typesense.advisory.sg` fires (the JS component never mounts).

Re-enable the toggle.

-   [ ] **Step 6: Verify the equal-set short-circuit**

Find a post where the SSR baseline already returns the most-relevant 3 posts (often true for posts with strong, narrow tag overlap). Reload. The Typesense response should equal the SSR set, and you should see NO grid mutation in DevTools (use the "Animations" panel or the "Highlight DOM updates" feature).

-   [ ] **Step 7: Verify mobile viewport**

Resize viewport to 375px. Cards stack into a single column (existing grid behavior). No layout regressions.

-   [ ] **Step 8: Final lint + git status**

```
npx gulp build
npm run test
git status --short
```

Build succeeds. Lint shows pre-existing baseline only (1 error in page.hbs, 1 warning about card_assets). `git status` is clean (no uncommitted changes).

-   [ ] **Step 9: Hand back to user**

Report:

-   Total commits added on this branch since the start of the plan.
-   Any verification step that didn't behave as expected.
-   Any deviations from the spec the implementer made.
-   Suggested next step (typically: invoke `superpowers:finishing-a-development-branch` for PR/merge).

---

## Self-review notes (writer's check)

**Spec coverage:**

-   Goal (replace tag-match with Typesense semantic ranking) → Tasks 1, 2, 4, 5, 6.
-   Cross-collection scope (no `filter_by` on routing tags) → Task 2 (`searchSimilar` doesn't accept `tagSlugs`).
-   Query construction (title + excerpt, capped at 500 chars) → Task 4 (`QUERY_MAX_CHARS`).
-   3-card target with topup behavior → Task 4 (`TARGET_COUNT`, dedup loop).
-   SSR baseline always renders → Task 5 (the `{{#if related}}` is moved inside the foreach so the wrapper itself doesn't depend on it).
-   Equal-set short-circuit → Task 4 (the sort+every check).
-   Card-building contract mirrors `post-card.hbs` → Task 4 (`buildCardElement`, with cross-reference comment).
-   `@custom.show_related_posts` preserved → Untouched in `post.hbs`, noted in file map.
-   API key handling (search-only, public-readable) → Tasks 1, 2 (constants + comments).
-   Defaults match production → Task 1 (package.json defaults), Task 2 (DEFAULTS in JS).
-   Failure modes (network, AbortError, 0 hits, current-post-in-results) → Task 4 try/catch + filter.
-   Documentation in README → Task 7.
-   Manual verification matrix → Task 8.

**Type / name consistency:**

-   `searchSimilar(query, options)` introduced in Task 2, called in Task 4. Same signature.
-   `getConfig()` introduced in Task 2 — internal to typesense-search.js, no consumers reference it.
-   `relatedPosts` exported function in Task 4, registered as `Alpine.data('relatedPosts', relatedPosts)` in Task 6, bound via `x-data="relatedPosts"` in Task 5. Names match.
-   `data-post-id`, `data-post-title`, `data-post-excerpt` set in Task 5 (`<section data-post-id={{post.id}}…>`), read in Task 4 (`root.dataset.postId`, etc.). Camelcase auto-conversion correct (`post-id` → `postId`).
-   `data-slug` added in Task 3 (`<article data-slug={{slug}}>`), queried in Task 4 (`grid.querySelectorAll('.feed-card[data-slug]')`). Names match.
-   `TARGET_COUNT = 3` and `per_page: String(limit)` with `limit = 3` default match. The grid's `lg:grid-cols-3` from Task 5 also matches.
-   `RELATED_INCLUDE_FIELDS` in Task 2 includes `slug,title,excerpt,feature_image,url,tags,tags.name,tags.slug,published_at`. Task 4's `buildCardElement` reads `hit.slug`, `hit.url`, `hit.feature_image`, `hit.title`, `hit.excerpt`, `hit['tags.name']`, `hit['tags.slug']`, `hit.published_at`. All accounted for.
-   `pickPrimaryTag` falls back to `hit.tags` (just names) if `hit['tags.name']` is missing — defensive, harmless.
