import { serve } from "@hono/node-server";
import GhostContentAPI from "@tryghost/content-api";
import Typesense from "typesense";
import { createApp, type Ghost, type Index } from "./app.js";
import type { GhostPost } from "./transform.js";

const env = process.env;
const required = [
    "GHOST_URL",
    "GHOST_CONTENT_API_KEY",
    "TYPESENSE_HOST",
    "TYPESENSE_API_KEY",
    "WEBHOOK_SECRET",
];
const missing = required.filter((k) => !env[k]);
if (missing.length)
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);

const collection = env.COLLECTION_NAME ?? "ghost";
const port = Number(env.PORT ?? 8080);
const READ_OPTS = {
    formats: ["html", "plaintext"],
    include: ["tags", "authors"],
};

const gcapi = new GhostContentAPI({
    url: env.GHOST_URL!,
    key: env.GHOST_CONTENT_API_KEY!,
    version: env.GHOST_API_VERSION ?? "v6.0",
});

const ghost: Ghost = {
    read: (id) => gcapi.posts.read({ id }, READ_OPTS),
    all: async () => {
        const all: GhostPost[] = [];
        let page = 1;
        let pages = 1;
        do {
            const res = await gcapi.posts.browse({
                limit: 100,
                page,
                ...READ_OPTS,
            });
            all.push(...res);
            pages = res?.meta?.pagination?.pages ?? 1;
            page += 1;
        } while (page <= pages);
        return all;
    },
};

const ts = new Typesense.Client({
    nodes: [
        {
            host: env.TYPESENSE_HOST!,
            port: Number(env.TYPESENSE_PORT ?? 443),
            protocol: env.TYPESENSE_PROTOCOL ?? "https",
        },
    ],
    apiKey: env.TYPESENSE_API_KEY!,
    connectionTimeoutSeconds: 5,
});
const docs = () => ts.collections(collection).documents();

const index: Index = {
    upsert: (doc) => docs().upsert(doc),
    remove: async (id) => {
        try {
            await ts.collections(collection).documents(id).delete();
        } catch (err) {
            if ((err as { httpStatus?: number })?.httpStatus !== 404) throw err;
        }
    },
    importAll: (all) => docs().import(all, { action: "upsert" }),
    ids: async () => {
        const jsonl = (await docs().export({ include_fields: "id" })) as string;
        return jsonl
            .split("\n")
            .filter(Boolean)
            .map((line) => JSON.parse(line).id as string);
    },
};

const deps = { ghost, index, secret: env.WEBHOOK_SECRET! };

serve({ fetch: createApp(deps).fetch, port }, (info) => {
    console.log(`sync server listening on :${info.port}`);
});
