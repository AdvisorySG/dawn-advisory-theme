// Wrapper around Typesense's search REST API for the post-filter-list component.
//
// Configuration source of truth is `package.json` under `config.custom.typesense_*`,
// admin-overridable in Ghost → Design → Customize. `default.hbs` injects
// the resolved values into `window.__TYPESENSE_CONFIG__` before this bundle loads.
//
// The API key is a *search-only* key — Typesense's analogue of Ghost's Content
// API key. It is read-only and scoped to the configured collection. Embedding
// it client-side is intentional and safe (Typesense convention).
//
// Schema verified live on 2026-05-06: collection holds 283 documents with
// fields title, slug, excerpt, plaintext, feature_image, url, tags.name,
// tags.slug, published_at, etc.

// Defaults match the Advisory SG production Typesense instance. They serve as
// fallbacks when the inline config script is missing (e.g. partial page renders
// without default.hbs) or returns empty values from an admin-cleared override.
const DEFAULTS = {
    host: 'https://typesense.advisory.sg',
    apiKey: 'LWQ1uyADTZBRVJa0XuFY5BcipgnhvQ8g',
    collection: 'ghost',
};

function getConfig() {
    const cfg =
        (typeof window !== 'undefined' && window.__TYPESENSE_CONFIG__) || {};
    return {
        host: cfg.host || DEFAULTS.host,
        apiKey: cfg.apiKey || DEFAULTS.apiKey,
        collection: cfg.collection || DEFAULTS.collection,
    };
}

// Fields and weights used by list-page search — see spec.
const QUERY_BY = 'title,excerpt,plaintext';
const QUERY_BY_WEIGHTS = '4,2,1';
const PER_PAGE = 250;

// Fields the related-posts card builder needs. Keep in sync with the field
// list in assets/js/related-posts.js → buildCardElement().
const RELATED_INCLUDE_FIELDS =
    'id,slug,title,excerpt,feature_image,url,tags.name,tags.slug,published_at';

// Title hits weighted highest, then excerpt, then plaintext.
const RELATED_QUERY_BY = 'title,excerpt,plaintext';
const RELATED_QUERY_BY_WEIGHTS = '4,2,1';

/**
 * Search the configured Typesense collection and return matching post slugs.
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
    const { host, apiKey, collection } = getConfig();

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

    const url = `${host}/collections/${collection}/documents/search?${params.toString()}`;
    const response = await fetch(url, {
        headers: { 'X-TYPESENSE-API-KEY': apiKey },
        signal,
    });
    if (!response.ok) {
        throw new Error(`Typesense HTTP ${response.status}`);
    }
    const data = await response.json();
    const slugs = (data.hits || []).map((h) => h.document.slug);
    return new Set(slugs);
}

/**
 * Find documents semantically similar to a free-text query (typically a
 * post's "title\nexcerpt"). Returns rich hit objects sufficient for
 * client-side card rendering.
 *
 * @param {string} query - Free-text query, expected to be already trimmed and
 *                         length-capped by the caller (see related-posts.js).
 * @param {object} options
 * @param {string} [options.excludeId] - Document id to exclude (e.g. the current post).
 * @param {string} [options.excludeSlug] - Document slug to ALSO exclude. Belt-
 *                         and-braces in case excludeId is empty/wrong; both
 *                         conditions are AND'd in filter_by so a doc matching
 *                         either identifier is excluded.
 * @param {number} [options.limit=3] - Max hits to return.
 * @param {AbortSignal} [options.signal] - Aborts the request.
 * @returns {Promise<object[]>} Array of hit documents (slug, title, excerpt,
 *                              feature_image, url, tags, tags.slug, published_at).
 *                              Empty array on zero hits.
 * @throws {Error} on network failure, non-2xx, or malformed JSON. AbortError
 *                 is propagated as-is so callers can distinguish.
 */
export async function searchSimilar(query, options = {}) {
    const { excludeId, excludeSlug, limit = 3, signal } = options;
    const { host, apiKey, collection } = getConfig();

    const params = new URLSearchParams({
        q: query,
        query_by: RELATED_QUERY_BY,
        query_by_weights: RELATED_QUERY_BY_WEIGHTS,
        include_fields: RELATED_INCLUDE_FIELDS,
        per_page: String(limit),
    });
    const filters = [];
    if (excludeId) filters.push(`id:!=${excludeId}`);
    if (excludeSlug) filters.push(`slug:!=${excludeSlug}`);
    if (filters.length > 0) {
        params.set('filter_by', filters.join(' && '));
    }

    const url = `${host}/collections/${collection}/documents/search?${params.toString()}`;
    const response = await fetch(url, {
        headers: { 'X-TYPESENSE-API-KEY': apiKey },
        signal,
    });
    if (!response.ok) {
        throw new Error(`Typesense HTTP ${response.status}`);
    }
    const data = await response.json();
    return (data.hits || []).map((h) => h.document);
}
