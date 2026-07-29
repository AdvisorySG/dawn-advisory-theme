export interface GhostPost {
    id: string;
    title: string;
    url: string;
    slug: string;
    html: string;
    plaintext: string;
    excerpt: string;
    feature_image: string;
    published_at: string;
    updated_at: string;
    tags: { name: string; slug: string }[];
    authors: { name: string }[];
}

export interface TypesenseDoc {
    id: string;
    title: string;
    url: string;
    slug: string;
    html: string;
    plaintext: string;
    excerpt: string;
    feature_image: string;
    published_at: number;
    updated_at: number;
    tags: string[];
    "tags.name": string[];
    "tags.slug": string[];
    authors: string[];
}

function toMillis(value: string): number {
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? 0 : ms;
}

// Maps a Ghost post to the Typesense document shape that `ghost-typesense init` created.
// Note: tags, tags.name and tags.slug are three SEPARATE schema fields.
export function postToDoc(post: GhostPost): TypesenseDoc {
    return {
        id: post.id,
        title: post.title,
        url: post.url,
        slug: post.slug,
        html: post.html,
        plaintext: post.plaintext,
        excerpt: post.excerpt,
        feature_image: post.feature_image,
        published_at: toMillis(post.published_at),
        updated_at: toMillis(post.updated_at),
        tags: post.tags.map((t) => t.name),
        "tags.name": post.tags.map((t) => t.name),
        "tags.slug": post.tags.map((t) => t.slug),
        authors: post.authors.map((a) => a.name),
    };
}
