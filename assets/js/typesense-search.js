// Wrapper around Typesense's search REST API for the post-filter-list component.
//
// The TYPESENSE_API_KEY below is a *search-only* key — Typesense's analogue of
// Ghost's Content API key. It is read-only and scoped to the `ghost` collection.
// Embedding it client-side is intentional and safe (Typesense convention).
//
// Schema verified live on 2026-05-06: collection holds 283 documents with
// fields title, slug, excerpt, plaintext, tags.slug, published_at, etc.

const TYPESENSE_HOST = 'https://typesense.advisory.sg';
const TYPESENSE_API_KEY = 'LWQ1uyADTZBRVJa0XuFY5BcipgnhvQ8g';
const TYPESENSE_COLLECTION = 'ghost';

// Fields and weights — see spec.
const QUERY_BY = 'title,excerpt,plaintext';
const QUERY_BY_WEIGHTS = '4,2,1';
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
        include_fields: 'slug',
        per_page: String(PER_PAGE),
    });
    if (tagSlugs && tagSlugs.length > 0) {
        params.set('filter_by', `tags.slug:[${tagSlugs.join(',')}]`);
    }

    const url = `${TYPESENSE_HOST}/collections/${TYPESENSE_COLLECTION}/documents/search?${params.toString()}`;
    const response = await fetch(url, {
        headers: { 'X-TYPESENSE-API-KEY': TYPESENSE_API_KEY },
        signal,
    });
    if (!response.ok) {
        throw new Error(`Typesense HTTP ${response.status}`);
    }
    const data = await response.json();
    const slugs = (data.hits || []).map((h) => h.document.slug);
    return new Set(slugs);
}
