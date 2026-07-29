import { Hono } from "hono";
import { createHmac, timingSafeEqual } from "node:crypto";
import { postToDoc, type GhostPost, type TypesenseDoc } from "./transform.js";

export interface Ghost {
    read(id: string): Promise<GhostPost>; // throws { status: 404 } when gone
    all(): Promise<GhostPost[]>;
}
export interface Index {
    upsert(doc: TypesenseDoc): Promise<unknown>;
    remove(id: string): Promise<void>; // tolerates "not found"
    importAll(docs: TypesenseDoc[]): Promise<unknown>;
    ids(): Promise<string[]>;
}
export interface Environment {
    ghost: Ghost;
    index: Index;
    secret: string;
}

function status(err: unknown): number | undefined {
    const e = err as {
        response?: { status?: number };
        httpStatus?: number;
        statusCode?: number;
    };
    return e?.response?.status ?? e?.httpStatus ?? e?.statusCode;
}

// Constant-time compare of two arbitrary-length strings.
function secretMatches(provided: string | undefined, secret: string): boolean {
    if (!provided || !secret) return false;
    const a = createHmac("sha256", secret).update(provided).digest();
    const b = createHmac("sha256", secret).update(secret).digest();
    return timingSafeEqual(a, b);
}

interface GhostWebhookPayload {
    post?: {
        current?: { id?: string };
        previous?: { id?: string };
    };
}

function postId(payload: unknown): string | null {
    const p = payload as GhostWebhookPayload;
    return p.post?.current?.id ?? p.post?.previous?.id ?? null;
}

// Re-fetch the post: found -> upsert, 404 (deleted/unpublished/draft) -> delete.
export async function syncPost(
    environment: Environment,
    id: string,
): Promise<{ action: "upsert" | "delete"; id: string }> {
    try {
        await environment.index.upsert(
            postToDoc(await environment.ghost.read(id)),
        );
        return { action: "upsert", id };
    } catch (err) {
        if (status(err) === 404) {
            await environment.index.remove(id);
            return { action: "delete", id };
        }
        throw err;
    }
}

// Re-index everything, then drop docs that no longer exist in Ghost.
export async function fullSync(
    deps: Environment,
): Promise<{ indexed: number; deleted: number }> {
    const docs = (await deps.ghost.all()).map(postToDoc);
    await deps.index.importAll(docs);
    const live = new Set(docs.map((d) => d.id));
    const stale = (await deps.index.ids()).filter((id) => !live.has(id));
    for (const id of stale) await deps.index.remove(id);
    return { indexed: docs.length, deleted: stale.length };
}

export function createApp(deps: Environment): Hono {
    const app = new Hono();

    app.get("/healthz", (c) => c.json({ ok: true }));

    app.post("/webhook", async (c) => {
        if (!secretMatches(c.req.query("secret"), deps.secret))
            return c.json({ error: "unauthorized" }, 401);
        let id: string | null;
        try {
            id = postId(await c.req.json());
        } catch {
            return c.json({ error: "invalid json" }, 400);
        }
        if (!id) return c.json({ error: "no post id" }, 400);
        try {
            const result = await syncPost(deps, id);
            console.log("synced", result);
            return c.json(result, 200);
        } catch (err) {
            console.error("sync failed", {
                id,
                message: (err as Error).message,
            });
            return c.json({ error: "sync failed" }, 500);
        }
    });

    app.post("/sync", async (c) => {
        if (!secretMatches(c.req.query("secret"), deps.secret))
            return c.json({ error: "unauthorized" }, 401);
        try {
            const result = await fullSync(deps);
            console.log("full sync complete", result);
            return c.json(result, 200);
        } catch (err) {
            console.error("full sync failed", (err as Error).message);
            return c.json({ error: "sync failed" }, 500);
        }
    });

    return app;
}
