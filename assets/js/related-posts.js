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

import { searchSimilar } from './typesense-search.js';

const TARGET_COUNT = 3;
const QUERY_MAX_CHARS = 500; // keeps Typesense URL well under 8KB

export default function relatedPosts() {
    return {
        async init() {
            const root = this.$el;
            const grid = root.querySelector('.related-feed');
            if (!grid) return;

            const source = {
                id: root.dataset.postId || '',
                title: root.dataset.postTitle || '',
                excerpt: root.dataset.postExcerpt || '',
            };

            // Nothing to query with — leave SSR cards alone.
            if (!source.title && !source.excerpt) return;

            const ssrCards = Array.from(
                grid.querySelectorAll('.feed-card[data-slug]'),
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
                if (err.name !== 'AbortError') {
                    console.warn('related-posts: Typesense search failed', err);
                }
                return; // SSR cards stay
            }

            // Defensive: drop the source post if filter_by didn't suppress
            // it (compares by id since source.id is a Ghost ObjectId, not
            // a slug). Also drops malformed hits with no slug.
            hits = hits.filter((h) => h.id !== source.id && h.slug);

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
// excerpt + date / stretch-link anchor) byte-equivalent.
//
// Two intentional divergences from post-card.hbs:
//   1. We hardcode "feed-card post" instead of post-card's "feed-card {{post_class}}".
//      {{post_class}} also emits per-post tag-{slug} classes; no CSS in this
//      project targets those (verified against assets/css/), so skipping is safe.
//   2. We omit the <img> entirely when feature_image is empty; post-card.hbs
//      renders a hidden placeholder <img> instead. Both are display:none in
//      effect, so layout is equivalent for the related-posts grid.
function buildCardElement(hit) {
    const article = document.createElement('article');
    article.className =
        'feed-card post rounded-lg shadow-2xl m-auto w-full max-w-2xl md:max-w-full lg:h-full hover:shadow-md hover:border-opacity-0 transform hover:-translate-y-1 transition-all duration-200';
    article.dataset.slug = hit.slug || '';

    const inner = document.createElement('div');
    inner.className =
        'flex flex-col cursor-pointer h-full rounded-xl overflow-hidden md:flex-row md:h-80 lg:flex-col lg:h-full';
    inner.setAttribute('onclick', `location.href='${hit.url || '#'}'`);

    if (hit.feature_image) {
        const img = document.createElement('img');
        img.className =
            'object-cover m-0 h-full md:aspect-[9/5] lg:h-auto lg:aspect-[15/8]';
        img.src = hit.feature_image;
        img.alt = hit.title || '';
        inner.appendChild(img);
    }

    const body = document.createElement('div');
    body.className = 'grow bg-white px-3 pt-3 pb-5 relative';

    // Primary tag = first non-routing tag (routing tags start with "hash-").
    const primaryTag = pickPrimaryTag(hit);
    if (primaryTag) {
        const tagSpan = document.createElement('span');
        tagSpan.className = 'single-meta-item single-meta-tag';
        const tagAnchor = document.createElement('a');
        tagAnchor.className = `post-tag post-tag-${primaryTag.slug} text-lg uppercase font-extrabold`;
        tagAnchor.href = `/tag/${primaryTag.slug}/`;
        tagAnchor.textContent = primaryTag.name;
        tagSpan.appendChild(tagAnchor);
        body.appendChild(tagSpan);
    } else {
        const noTag = document.createElement('span');
        noTag.className = 'text-lg uppercase font-extrabold';
        noTag.textContent = '[No tag]';
        body.appendChild(noTag);
    }

    const titleEl = document.createElement('p');
    titleEl.className = 'text-2xl font-bold my-2';
    titleEl.textContent = hit.title || '';
    body.appendChild(titleEl);

    const excerptEl = document.createElement('p');
    excerptEl.className = 'text-xl my-1 line-clamp-4';
    excerptEl.textContent = hit.excerpt || '';
    body.appendChild(excerptEl);

    const spacer = document.createElement('div');
    spacer.className = 'h-8';
    body.appendChild(spacer);

    const dateWrap = document.createElement('div');
    dateWrap.className = 'text-xl absolute right-4 bottom-4';
    const clockIcon = document.createElement('i');
    clockIcon.className = 'far fa-clock';
    dateWrap.appendChild(clockIcon);
    if (hit.published_at) {
        const date = new Date(hit.published_at);
        const timeEl = document.createElement('time');
        timeEl.dateTime = date.toISOString().split('T')[0];
        timeEl.textContent =
            ' ' +
            date.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
            });
        dateWrap.appendChild(timeEl);
    }
    body.appendChild(dateWrap);

    inner.appendChild(body);

    const stretchAnchor = document.createElement('a');
    stretchAnchor.href = hit.url || '#';
    const stretchSpan = document.createElement('span');
    stretchSpan.className = 'stretch-link';
    stretchAnchor.appendChild(stretchSpan);
    inner.appendChild(stretchAnchor);

    article.appendChild(inner);
    return article;
}

// First non-hash-prefixed tag from the parallel tags.name / tags.slug arrays.
// Returns null if all tags are routing tags or arrays are missing/empty.
// Both arrays are requested via RELATED_INCLUDE_FIELDS in typesense-search.js.
function pickPrimaryTag(hit) {
    const names = hit['tags.name'] || [];
    const slugs = hit['tags.slug'] || [];
    for (let i = 0; i < slugs.length; i++) {
        if (slugs[i] && !slugs[i].startsWith('hash-')) {
            return { name: names[i] || slugs[i], slug: slugs[i] };
        }
    }
    return null;
}
