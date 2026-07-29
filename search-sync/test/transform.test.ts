import { test, expect } from "vitest";
import { postToDoc, type GhostPost } from "../src/transform.js";

const post: GhostPost = {
    id: "6500abc",
    title: "Hello World",
    url: "https://advisory.sg/hello/",
    slug: "hello",
    html: "<p>Hi <b>there</b></p>",
    plaintext: "Hi there",
    excerpt: "Hi",
    feature_image: "https://advisory.sg/img.jpg",
    published_at: "2024-01-02T03:04:05.000Z",
    updated_at: "2024-02-03T04:05:06.000Z",
    tags: [
        { name: "News", slug: "news" },
        { name: "Law", slug: "law" },
    ],
    authors: [{ name: "Jane Doe" }],
};

test("postToDoc maps every field with millisecond timestamps", () => {
    const doc = postToDoc(post);
    expect(doc.id).toBe("6500abc");
    expect(doc.title).toBe("Hello World");
    expect(doc.url).toBe("https://advisory.sg/hello/");
    expect(doc.slug).toBe("hello");
    expect(doc.html).toBe("<p>Hi <b>there</b></p>");
    expect(doc.plaintext).toBe("Hi there");
    expect(doc.excerpt).toBe("Hi");
    expect(doc.feature_image).toBe("https://advisory.sg/img.jpg");
    expect(doc.published_at).toBe(Date.parse("2024-01-02T03:04:05.000Z"));
    expect(doc.updated_at).toBe(Date.parse("2024-02-03T04:05:06.000Z"));
    expect(doc.tags).toEqual(["News", "Law"]);
    expect(doc["tags.name"]).toEqual(["News", "Law"]);
    expect(doc["tags.slug"]).toEqual(["news", "law"]);
    expect(doc.authors).toEqual(["Jane Doe"]);
});

test("postToDoc coerces an unparseable timestamp to 0", () => {
    const doc = postToDoc({ ...post, published_at: "not-a-date" });
    expect(doc.published_at).toBe(0);
});
