import { test, expect, vi } from "vitest";
import {
    createApp,
    syncPost,
    fullSync,
    type Ghost,
    type Index,
} from "../src/app.js";
import type { GhostPost } from "../src/transform.js";

const SECRET = "s3cret";
const POST: GhostPost = {
    id: "p1",
    title: "T",
    url: "https://advisory.sg/t/",
    slug: "t",
    html: "<p>T</p>",
    plaintext: "T",
    excerpt: "T",
    feature_image: "",
    published_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    tags: [],
    authors: [],
};

function fakeIndex(overrides: Partial<Index> = {}): Index {
    return {
        upsert: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        importAll: vi.fn().mockResolvedValue(undefined),
        ids: vi.fn().mockResolvedValue([]),
        ...overrides,
    };
}

test("syncPost upserts when the post exists", async () => {
    const index = fakeIndex();
    const ghost: Ghost = {
        read: vi.fn().mockResolvedValue(POST),
        all: vi.fn(),
    };
    expect(await syncPost({ ghost, index, secret: SECRET }, "p1")).toEqual({
        action: "upsert",
        id: "p1",
    });
    expect(index.upsert).toHaveBeenCalledOnce();
    expect(index.remove).not.toHaveBeenCalled();
});

test("syncPost deletes when the post is gone (404)", async () => {
    const index = fakeIndex();
    const ghost: Ghost = {
        read: vi.fn().mockRejectedValue({ response: { status: 404 } }),
        all: vi.fn(),
    };
    expect(await syncPost({ ghost, index, secret: SECRET }, "p1")).toEqual({
        action: "delete",
        id: "p1",
    });
    expect(index.remove).toHaveBeenCalledWith("p1");
});

test("fullSync indexes live posts and removes stale ones", async () => {
    const index = fakeIndex({ ids: vi.fn().mockResolvedValue(["p1", "old"]) });
    const ghost: Ghost = {
        read: vi.fn(),
        all: vi.fn().mockResolvedValue([POST]),
    };
    expect(await fullSync({ ghost, index, secret: SECRET })).toEqual({
        indexed: 1,
        deleted: 1,
    });
    expect(index.remove).toHaveBeenCalledWith("old");
});

function app(
    overrides: { ghost?: Partial<Ghost>; index?: Partial<Index> } = {},
) {
    const ghost: Ghost = {
        read: vi.fn().mockResolvedValue(POST),
        all: vi.fn().mockResolvedValue([POST]),
        ...overrides.ghost,
    };
    return createApp({
        ghost,
        index: fakeIndex(overrides.index),
        secret: SECRET,
    });
}

const webhook = (
    secret: string,
    body: unknown = { post: { current: { id: "p1" } } },
) =>
    new Request(`http://x/webhook?secret=${secret}`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
    });

test("GET /healthz returns ok", async () => {
    const res = await app().request("http://x/healthz");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
});

test("POST /webhook rejects a bad secret", async () => {
    const res = await app().request(webhook("wrong"));
    expect(res.status).toBe(401);
});

test("POST /webhook with no secret is unauthorized", async () => {
    const res = await app().request(
        new Request("http://x/webhook", {
            method: "POST",
            body: "{}",
            headers: { "content-type": "application/json" },
        }),
    );
    expect(res.status).toBe(401);
});

test("POST /webhook upserts a valid post", async () => {
    const res = await app().request(webhook(SECRET));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ action: "upsert", id: "p1" });
});

test("POST /webhook with no post id returns 400", async () => {
    const res = await app().request(webhook(SECRET, { post: {} }));
    expect(res.status).toBe(400);
});

test("POST /webhook returns 500 when indexing throws", async () => {
    const res = await app({
        index: { upsert: vi.fn().mockRejectedValue(new Error("boom")) },
    }).request(webhook(SECRET));
    expect(res.status).toBe(500);
});

test("POST /sync runs a full reconcile", async () => {
    const res = await app().request(
        new Request(`http://x/sync?secret=${SECRET}`, { method: "POST" }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ indexed: 1, deleted: 0 });
});
