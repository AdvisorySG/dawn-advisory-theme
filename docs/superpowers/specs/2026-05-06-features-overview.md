# Features Overview — 2026-05-06

Two independent features captured during brainstorming. Each will get its own
full design doc and implementation plan. This file is a high-level index so
neither feature is lost; it is **not** a spec.

## Feature 1 — Sort & filter on Interviews and Events pages (PRIORITY)

**Pages affected:** `index.hbs` (Interviews), `events.hbs` (Events).

**Current state:**

-   Server-rendered Ghost collections defined in `config/routes.yaml`:
    -   Events filters by internal tag `#insights`
    -   Interviews filters by internal tags `#conversations` or `#reflections`
-   `partials/tags-listing.hbs` shows a tag dropdown, but selecting a tag
    navigates to `/tag/<slug>` instead of filtering in place
-   No sort control exists

**Goal:** Let users sort and filter the post listing in place on each page,
without leaving the listing context.

**Status:** In active design — see `2026-05-06-sort-filter-design.md` (to be
written).

## Feature 2 — More targeted suggested articles on post pages

**Files affected:** `partials/related.hbs`, `post.hbs`.

**Current state:** `partials/related.hbs` runs
`{{#get "posts" limit="3" filter="tags:[{{post.tags}}]+id:-{{post.id}}"}}`.
The `tags:[a,b,c]` filter is OR (not AND), so any post sharing a single tag
matches; results are ordered by default (published date desc). Not really
targeted.

**Goal:** Surface related posts that are actually closely related — primary
tag overlap, author match, recency — instead of any-tag matches.

**Status:** Deferred. Will be brainstormed in a separate session after
Feature 1 ships.
