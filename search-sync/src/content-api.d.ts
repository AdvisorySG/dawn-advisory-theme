declare module "@tryghost/content-api" {
    import type { GhostPost } from "./transform.js";

    interface BrowseResult extends Array<GhostPost> {
        meta?: { pagination?: { pages?: number } };
    }

    export default class GhostContentAPI {
        constructor(config: { url: string; key: string; version: string });
        posts: {
            read(data: { id: string }, options?: object): Promise<GhostPost>;
            browse(options?: object): Promise<BrowseResult>;
        };
    }
}
