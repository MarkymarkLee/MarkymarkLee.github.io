import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { loadContent } from "./content.ts";
import { renderSite } from "./pages.ts";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "site-"));
  await mkdir(join(root, "blog", "with-image"), { recursive: true });
  await writeFile(
    join(root, "site.yaml"),
    "name: T\ntagline: t\ndescription: d\nurl: https://x.test/\nsocials: []\n",
  );
  await writeFile(join(root, "cv.md"), "# CV");
  await writeFile(join(root, "blog", "old.md"), "---\ntitle: Old\ndate: 2020-01-01\n---\nold");
  await writeFile(
    join(root, "blog", "secret.md"),
    "---\ntitle: Secret\ndate: 2030-01-01\ndraft: true\n---\nshh",
  );
  await writeFile(
    join(root, "blog", "with-image", "index.md"),
    "---\ntitle: New\ndate: 2024-05-01\n---\n![](pic.png)",
  );
  await writeFile(join(root, "blog", "with-image", "pic.png"), "png");
  return root;
}

const assets = { base: "", home: "" };

describe("content build", () => {
  it("drops drafts, sorts newest first, and writes pretty URLs with assets", async () => {
    const c = await loadContent(await fixture());
    expect(c.posts.map((p) => p.slug)).toEqual(["with-image", "old"]);
    expect(c.site.url).toBe("https://x.test");

    const files = await renderSite(c, assets);
    expect(files.has("blog/old/index.html")).toBe(true);
    expect(files.has("blog/with-image/pic.png")).toBe(true);
    expect([...files.keys()].some((k) => k.includes("secret"))).toBe(false);
    expect(files.get("rss.xml")).toContain("https://x.test/blog/old/");
  });

  it("keeps drafts in dev", async () => {
    const c = await loadContent(await fixture(), { drafts: true });
    expect(c.posts[0].slug).toBe("secret");
  });

  it("rejects a bad date", async () => {
    const root = await fixture();
    await writeFile(join(root, "blog", "bad.md"), "---\ntitle: Bad\ndate: May 1\n---\n");
    await expect(loadContent(root)).rejects.toThrow(/YYYY-MM-DD/);
  });
});
