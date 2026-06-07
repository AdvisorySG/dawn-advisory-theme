import { searchSlugs } from './typesense-search.js';
// Alpine component for client-side multi-tag filter, sort, search, load-more, and URL sync.
// Used by partials/post-filter-list.hbs on /events/ and /interviews/.
//
// Call site:
//   <div x-data="postFilterList({ collection: 'events', mode: 'or', tagSlugs: 'hash-insights,...' })" ...>
//
// Parameters:
//   collection: passed through for the partial's DOM id namespace; not used here.
//   mode: 'or' (default) or 'and'. Selects matching function for chips.
//   tagSlugs: comma-separated string of tag slugs scoping this collection.
//             Parsed into an array and passed to searchSlugs() as the
//             Typesense filter_by value so cross-collection slug results
//             don't bleed into this page.
// Sort modes accepted in URL params and the dropdown UI.
// Keep this list in sync with the <select> options in partials/post-filter-list.hbs
// and the cases in _sorted() below.
const VALID_SORTS = ['newest', 'oldest', 'az', 'za'];

export default function postFilterList({ collection, mode, tagSlugs }) {
    const PAGE_SIZE = 12;

    return {
        // --- state -------------------------------------------------------
        selectedTags: [],
        tagDropdownOpen: false,
        sortMode: 'newest', // 'newest' | 'oldest' | 'az' | 'za'
        visibleCount: PAGE_SIZE,
        allCards: [],
        availableTags: [],
        tagSlugs: (tagSlugs || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        searchQuery: '',
        searchSlugs: null, // null = no search active or query < 2 chars; Set = Typesense results
        searchError: false,
        isSearching: false,
        _searchAbortController: null,
        _searchDebounceTimer: null,

        // --- lifecycle ---------------------------------------------------

        init() {
            this.allCards = this._readCardsFromDom();
            this.availableTags = this._buildAvailableTags(this.allCards);

            const state = this._readStateFromUrl();
            this.selectedTags = state.tags;
            this.sortMode = state.sort;
            // Normalize sub-threshold queries to '' so the input doesn't
            // display a stale character with no active search behind it.
            this.searchQuery = state.q.trim().length >= 2 ? state.q : '';

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

        // --- queries -----------------------------------------------------

        matches(card) {
            if (this.selectedTags.length === 0) return true;
            if (mode === 'and') {
                return this.selectedTags.every((t) => card.tagSlugs.has(t));
            }
            return this.selectedTags.some((t) => card.tagSlugs.has(t));
        },

        filtered() {
            let result = this.allCards.filter((c) => this.matches(c));
            if (this.searchSlugs !== null) {
                result = result.filter((c) => this.searchSlugs.has(c.slug));
            }
            return this._sorted(result);
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

        // True when any user-controlled dimension is non-default — drives
        // the visibility of every Clear-filters affordance.
        hasActiveFilters() {
            return (
                this.selectedTags.length > 0 ||
                this.searchQuery.trim().length > 0 ||
                this.sortMode !== 'newest'
            );
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

        selectedTagLabel() {
            return this.selectedTags.length
                ? `Tags (${this.selectedTags.length})`
                : 'Tags';
        },

        clearTags() {
            this.selectedTags = [];
        },

        toggleTagDropdown() {
            this.tagDropdownOpen = !this.tagDropdownOpen;
        },

        closeTagDropdown() {
            this.tagDropdownOpen = false;
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

        setSearchQuery(value) {
            this.searchQuery = value;
            clearTimeout(this._searchDebounceTimer);
            // Empty/short input goes through immediately so Esc-to-clear
            // doesn't leave the URL ?q= and result count stale for 250ms.
            if (value.trim().length < 2) {
                this._runSearch();
                return;
            }
            this._searchDebounceTimer = setTimeout(() => {
                this._runSearch();
            }, 250);
        },

        clearFilters() {
            this.selectedTags = [];
            this.sortMode = 'newest';
            this.searchQuery = '';
            // Cancel any in-flight search and pending debounce so a stale
            // response can't overwrite searchSlugs after the clear.
            if (this._searchAbortController) {
                this._searchAbortController.abort();
            }
            clearTimeout(this._searchDebounceTimer);
            this.searchSlugs = null;
            this.searchError = false;
            this.isSearching = false;
            // selectedTags/sortMode watchers fire only on change. Force a URL
            // write so ?q= and ?sort= drop even when those weren't dirty.
            this._writeStateToUrl();
        },

        // --- internals ---------------------------------------------------

        _sorted(cards) {
            const sorted = [...cards];
            switch (this.sortMode) {
                case 'oldest':
                    sorted.sort((a, b) =>
                        a.publishedAt.localeCompare(b.publishedAt),
                    );
                    break;
                case 'az':
                    sorted.sort((a, b) => a.title.localeCompare(b.title));
                    break;
                case 'za':
                    sorted.sort((a, b) => b.title.localeCompare(a.title));
                    break;
                case 'newest':
                default:
                    sorted.sort((a, b) =>
                        b.publishedAt.localeCompare(a.publishedAt),
                    );
                    break;
            }
            return sorted;
        },

        // Reorders ALL .filter-card-wrapper nodes in the grid to match the current sort.
        // Hidden cards (x-show=false → display:none) reorder along with visible ones;
        // CSS Grid skips display:none items in auto-flow, so the visible ones lay out
        // in their new DOM order.
        //
        // Assumes every .filter-card-wrapper shares the same parent element (the
        // #post-grid-{collection} div in post-filter-list.hbs). If a future partial
        // change splits cards across multiple containers, this loop will silently
        // re-parent them all to the first card's parent.
        _reorderDom() {
            if (this.allCards.length === 0) return;
            const grid = this.allCards[0].el.parentNode;
            if (!grid) return;
            const sorted = this._sorted(this.allCards);
            sorted.forEach((c) => grid.appendChild(c.el));
        },

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

            // Capture the controller locally so finally{} can tell whether
            // THIS call is still the latest. Without this, an aborted call's
            // finally{} flips isSearching=false while the superseding call is
            // still in flight, making the spinner flicker off mid-typing.
            const controller = new AbortController();
            this._searchAbortController = controller;
            this.isSearching = true;

            try {
                const slugs = await searchSlugs(
                    trimmed,
                    this.tagSlugs,
                    controller.signal,
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
                if (this._searchAbortController === controller) {
                    this.isSearching = false;
                }
            }
        },

        _readCardsFromDom() {
            const root = this.$root || this.$el;
            const wrappers = root.querySelectorAll('.filter-card-wrapper');
            return Array.from(wrappers).map((el) => {
                const inner = el.querySelector('[data-tags]');
                const slugs = (
                    inner && inner.dataset.tags ? inner.dataset.tags : ''
                )
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                return {
                    el,
                    tagSlugs: new Set(slugs),
                    slug: (inner && inner.dataset.slug) || '',
                    title: (inner && inner.dataset.title) || '',
                    publishedAt: (inner && inner.dataset.publishedAt) || '',
                };
            });
        },

        _buildAvailableTags(cards) {
            const map = new Map();
            cards.forEach(({ el }) => {
                const inner = el.querySelector('[data-tags]');
                if (!inner) return;
                const slugs = (inner.dataset.tags || '').split(',');
                const names = (inner.dataset.tagNames || '').split('|');
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

            const tags = (params.get('tags') || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);

            const rawSort = params.get('sort') || 'newest';
            const sort = VALID_SORTS.includes(rawSort) ? rawSort : 'newest';

            const q = params.get('q') || '';

            return { tags, sort, q };
        },

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
    };
}
