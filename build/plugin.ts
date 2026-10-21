import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import type { Plugin } from "vite-plus";
import { loadContent } from "./content.ts";
import { renderSite, type Assets, type Files } from "./pages.ts";

const ENTRIES = { main: "src/main.ts", home: "src/home.ts" };

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

interface ManifestChunk {
  file: string;
  css?: string[];
  imports?: string[];
}

// Renders content/ into static pages: served from memory in dev, written to dist on build.
export function site(): Plugin {
  let root = process.cwd();
  return {
    name: "site",
    config(_, { command }) {
      if (command !== "build") return { appType: "custom" };
      return {
        appType: "custom",
        build: { manifest: true, rolldownOptions: { input: ENTRIES } },
      };
    },
    configResolved(config) {
      root = config.root;
    },

    configureServer(server) {
      const contentDir = resolve(root, "content");
      const dev: Assets = {
        base: `<script type="module" src="/${ENTRIES.main}"></script>`,
        home: `<script type="module" src="/${ENTRIES.home}"></script>`,
      };
      let cache: Promise<Files> | null = null;
      const files = () =>
        (cache ??= loadContent(contentDir, { drafts: true }).then((c) => renderSite(c, dev)));
      const reload = (file: string) => {
        if (!file.startsWith(contentDir)) return;
        cache = null;
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.add(contentDir);
      server.watcher.on("change", reload);
      server.watcher.on("add", reload);
      server.watcher.on("unlink", reload);

      server.middlewares.use(async (req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") return next();
        const url = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
        let key = url.slice(1);
        if (key === "" || key.endsWith("/")) key += "index.html";
        let all: Files;
        try {
          all = await files();
        } catch (e) {
          cache = null;
          return next(e);
        }
        let body = all.get(key);
        if (body === undefined && all.has(`${key}/index.html`)) {
          res.writeHead(301, { Location: `${url}/` });
          return res.end();
        }
        if (body === undefined) return next();
        if (key.endsWith(".html")) body = await server.transformIndexHtml(url, body as string);
        res.setHeader("Content-Type", TYPES[extname(key)] ?? "application/octet-stream");
        res.end(body);
      });
    },

    async writeBundle(options) {
      const outDir = options.dir ?? resolve(root, "dist");
      const manifestPath = join(outDir, ".vite", "manifest.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<
        string,
        ManifestChunk
      >;
      const tags = (key: string, seen = new Set<string>()): string => {
        if (seen.has(key)) return "";
        seen.add(key);
        const chunk = manifest[key];
        const css = (chunk.css ?? []).map((f) => `<link rel="stylesheet" href="/${f}">`).join("");
        const deps = (chunk.imports ?? []).map((k) => tags(k, seen)).join("");
        return css + deps;
      };
      const entry = (key: string) =>
        `${tags(key)}<script type="module" src="/${manifest[key].file}"></script>`;
      const assets: Assets = { base: entry(ENTRIES.main), home: entry(ENTRIES.home) };

      const files = await renderSite(await loadContent(resolve(root, "content")), assets);
      for (const [path, body] of files) {
        const dest = join(outDir, path);
        await mkdir(dirname(dest), { recursive: true });
        await writeFile(dest, body);
      }
      await rm(join(outDir, ".vite"), { recursive: true, force: true });
    },
  };
}
