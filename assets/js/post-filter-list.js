// Alpine component for client-side multi-tag filter, load-more, and URL sync.
// Used by partials/post-filter-list.hbs on /events/ and /interviews/.
//
// Call site:
//   <div x-data="postFilterList({ collection: 'events', mode: 'or' })" ...>
//
// Parameters:
//   collection: passed through for the partial's DOM id namespace; not used here.
//   mode: 'or' (default) or 'and'. Selects matching function.
export default function postFilterList({ collection, mode }) {
    const PAGE_SIZE = 12;

    return {
        selectedTags: [],
        visibleCount: PAGE_SIZE,
        allCards: [],
        availableTags: [],

        init() {
            this.allCards = this._readCardsFromDom();
            this.availableTags = this._buildAvailableTags(this.allCards);
            this.selectedTags = this._readTagsFromUrl();
            this.$watch('selectedTags', () => {
                this.visibleCount = PAGE_SIZE;
                this._writeTagsToUrl();
            });
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
            return this.allCards.filter((c) => this.matches(c));
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
            // The wrapper element carries tabindex="-1" (set in the partial).
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
            const wrappers = root.querySelectorAll('.filter-card-wrapper');
            return Array.from(wrappers).map((el) => {
                const inner = el.querySelector('[data-tags]');
                const slugs = (
                    inner && inner.dataset.tags ? inner.dataset.tags : ''
                )
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                return { el, tagSlugs: new Set(slugs) };
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

        _readTagsFromUrl() {
            const params = new URLSearchParams(window.location.search);
            const raw = params.get('tags') || '';
            return raw
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
        },

        _writeTagsToUrl() {
            const params = new URLSearchParams(window.location.search);
            if (this.selectedTags.length) {
                params.set('tags', this.selectedTags.join(','));
            } else {
                params.delete('tags');
            }
            const qs = params.toString();
            const newUrl = qs
                ? `${window.location.pathname}?${qs}`
                : window.location.pathname;
            window.history.replaceState(null, '', newUrl);
        },
    };
}
