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

// Fields the related-posts card builder needs. Keep in sync with the field
// list in assets/js/related-posts.js → buildCardElement().
const RELATED_INCLUDE_FIELDS =
    'slug,title,excerpt,feature_image,url,tags,tags.name,tags.slug,published_at';

// Title hits weighted highest, then excerpt, then plaintext.
const RELATED_QUERY_BY = 'title,excerpt,plaintext';
const RELATED_QUERY_BY_WEIGHTS = '4,2,1';

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
        params.set('filter_by', `id:!=${excludeId}`);
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
