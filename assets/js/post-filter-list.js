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
        sortMode: 'newest', // 'newest' | 'oldest' | 'az' | 'za'
        visibleCount: PAGE_SIZE,
        allCards: [],
        availableTags: [],
        tagSlugs: (tagSlugs || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),

        // --- lifecycle ---------------------------------------------------

        init() {
            this.allCards = this._readCardsFromDom();
            this.availableTags = this._buildAvailableTags(this.allCards);

            const state = this._readStateFromUrl();
            this.selectedTags = state.tags;
            this.sortMode = state.sort;

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
            this.sortMode = 'newest';
            // Search reset added in Task 7.
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
            const validSorts = ['newest', 'oldest', 'az', 'za'];
            const sort = validSorts.includes(rawSort) ? rawSort : 'newest';

            return { tags, sort };
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

            const qs = params.toString();
            const newUrl = qs
                ? `${window.location.pathname}?${qs}`
                : window.location.pathname;
            window.history.replaceState(null, '', newUrl);
        },
    };
}
