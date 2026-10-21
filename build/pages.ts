import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { deflateSync, crc32 } from "node:zlib";
import { runs, spriteGrid } from "../src/slime/raster.ts";
import type { Content, Post, Project } from "./content.ts";

// Script/style tags for each page kind: dev points at /src, build at hashed files.
export interface Assets {
  base: string;
  home: string;
}

// Output path (relative to the site root) -> file contents.
export type Files = Map<string, string | Uint8Array>;

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

const fmtDate = (d: string) =>
  new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

// Same mocha colours the canvas uses, for places CSS variables can't reach.
const SPRITE_HEX = ["", "#89b4fa", "#5b87d6", "#dbe7fd", "#11111b", "#cdd6f4"];
const SPRITE_VAR = ["", "--slime", "--slime-edge", "--slime-shine", "--slime-eye", "--slime-glint"];

export function spriteSvg(themed: boolean): string {
  const g = spriteGrid(16);
  let rects = "";
  for (const [code, c, r, len] of runs(g)) {
    const fill = themed ? `style="fill:var(${SPRITE_VAR[code]})"` : `fill="${SPRITE_HEX[code]}"`;
    rects += `<rect x="${c}" y="${r}" width="${len}" height="1" ${fill}/>`;
  }
  const box = themed ? "0 2 16 13" : "0 0 16 16";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

// 1200x630 share image: the sprite, big, on Mocha base.
export function ogPng(): Uint8Array {
  const W = 1200,
    H = 630,
    cell = 26;
  const g = spriteGrid(16);
  const ox = (W - 16 * cell) / 2,
    oy = (H - 16 * cell) / 2 + 20;
  const rgb = SPRITE_HEX.map((h) =>
    h ? [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) : null,
  );
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    const row = y * (W * 3 + 1);
    for (let x = 0; x < W; x++) {
      const c = Math.floor((x - ox) / cell),
        r = Math.floor((y - oy) / cell);
      const code = c >= 0 && r >= 0 && c < 16 && r < 16 ? g.cells[r * 16 + c] : 0;
      const [R, G, B] = rgb[code] ?? [0x1e, 0x1e, 0x2e];
      raw[row + 1 + x * 3] = R;
      raw[row + 2 + x * 3] = G;
      raw[row + 3 + x * 3] = B;
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

interface PageOpts {
  path: string;
  title: string;
  description: string;
  body: string;
  home?: boolean;
}

function layout(c: Content, a: Assets, p: PageOpts): string {
  const { site } = c;
  const title = p.path === "/" ? site.name : `${p.title} · ${site.name}`;
  const nav = [
    ["/cv/", "CV"],
    ["/projects/", "Projects"],
    ["/blog/", "Blog"],
  ]
    .map(([href, label]) => {
      const current = p.path.startsWith(href) ? ' aria-current="page"' : "";
      return `<a href="${href}"${current}>${label}</a>`;
    })
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(p.description)}">
<link rel="canonical" href="${site.url}${p.path}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="alternate" type="application/rss+xml" title="${esc(site.name)}" href="/rss.xml">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:url" content="${site.url}${p.path}">
<meta property="og:image" content="${site.url}/og.png">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<script>try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
${a.base}${p.home ? a.home : ""}
</head>
<body>
<header class="site-header"><div class="wrap">
<a class="brand" href="/">${spriteSvg(true)}<span>${esc(site.name)}</span></a>
<nav class="site-nav" aria-label="Main">${nav}</nav>
<button id="theme-toggle" type="button" aria-label="Toggle light/dark theme">◐</button>
</div></header>
<main><div class="wrap">
${p.body}
</div></main>
<footer class="site-footer"><div class="wrap">© ${new Date().getFullYear()} ${esc(site.name)} · <a href="/rss.xml">RSS</a></div></footer>
</body>
</html>
`;
}

const tags = (t: string[]) =>
  t.length ? `<ul class="tags">${t.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "";

const postItem = (p: Post) => `<li>
<a href="/blog/${p.slug}/">${esc(p.title)}</a> ${p.draft ? '<span class="draft-badge">draft</span>' : ""}
<span class="meta"><time class="date" datetime="${p.date}">${fmtDate(p.date)}</time>${p.description ? " · " + esc(p.description) : ""}</span>
</li>`;

const projectHref = (p: Project) => `/projects/${p.slug}/`;
const imgSrc = (p: Project) =>
  p.image && !/^https?:|^\//.test(p.image) ? projectHref(p) + p.image : p.image;

const projectCard = (p: Project) => `<a class="card" href="${projectHref(p)}">
${p.image ? `<img src="${esc(imgSrc(p)!)}" alt="" loading="lazy">` : ""}
<div class="body"><h2>${esc(p.title)}</h2><p>${esc(p.summary)}</p>${tags(p.stack)}</div>
</a>`;

function homePage(c: Content): string {
  const { site } = c;
  const socials = site.socials
    .map((s) => `<li><a href="${esc(s.url)}" rel="me noopener">${esc(s.label)}</a></li>`)
    .join("");
  const latest = c.posts.slice(0, 3);
  const featured = c.projects.filter((p) => p.featured).slice(0, 3);
  return `<div class="home">
<div class="slime-box"><span class="hint">drag &amp; throw me</span><canvas id="slime" aria-label="A pixel slime you can drag and throw" role="img"></canvas></div>
<div class="intro">
<h1>${esc(site.name)}</h1>
<p class="tagline">${esc(site.tagline)}</p>
<ul class="socials">${socials}</ul>
${latest.length ? `<p class="label">Latest writing</p><ul class="list">${latest.map(postItem).join("")}</ul>` : ""}
${
  featured.length
    ? `<p class="label">Featured projects</p><ul class="list">${featured
        .map(
          (p) =>
            `<li><a href="${projectHref(p)}">${esc(p.title)}</a><span class="meta">${esc(p.summary)}</span></li>`,
        )
        .join("")}</ul>`
    : ""
}
</div>
</div>`;
}

function rss(c: Content): string {
  const { site } = c;
  const items = c.posts
    .map(
      (p) =>
        `<item><title>${esc(p.title)}</title><link>${site.url}/blog/${p.slug}/</link><guid>${site.url}/blog/${p.slug}/</guid><pubDate>${new Date(p.date + "T00:00:00Z").toUTCString()}</pubDate><description>${esc(p.description)}</description></item>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>${esc(site.name)}</title><link>${site.url}/</link><description>${esc(site.description)}</description>
${items}
</channel></rss>
`;
}

async function copyAssets(files: Files, dir: string | undefined, to: string) {
  if (!dir) return;
  for (const name of await readdir(dir)) {
    if (name !== "index.md") files.set(`${to}/${name}`, await readFile(join(dir, name)));
  }
}

export async function renderSite(c: Content, a: Assets): Promise<Files> {
  const files: Files = new Map();
  const { site } = c;
  const page = (out: string, p: PageOpts) => files.set(out, layout(c, a, p));

  page("index.html", {
    path: "/",
    title: site.name,
    description: site.description,
    body: homePage(c),
    home: true,
  });

  page("cv/index.html", {
    path: "/cv/",
    title: "CV",
    description: `CV of ${site.name}`,
    body: `<article class="prose narrow cv">${c.cv}</article>`,
  });

  page("projects/index.html", {
    path: "/projects/",
    title: "Projects",
    description: `Projects by ${site.name}`,
    body: `<div class="page-head"><h1>Projects</h1><p>Things I've built.</p></div><div class="cards">${c.projects.map(projectCard).join("")}</div>`,
  });
  for (const p of c.projects) {
    const links = [
      p.repo && `<a href="${esc(p.repo)}">Source</a>`,
      p.url && `<a href="${esc(p.url)}">Live</a>`,
    ]
      .filter(Boolean)
      .join("");
    page(`projects/${p.slug}/index.html`, {
      path: projectHref(p),
      title: p.title,
      description: p.summary,
      body: `<div class="page-head"><h1>${esc(p.title)}</h1><p>${esc(p.summary)}</p>${tags(p.stack)}${links ? `<div class="project-links">${links}</div>` : ""}</div><article class="prose">${p.html}</article>`,
    });
    await copyAssets(files, p.assetDir, `projects/${p.slug}`);
  }

  page("blog/index.html", {
    path: "/blog/",
    title: "Blog",
    description: `Writing by ${site.name}`,
    body: `<div class="narrow"><div class="page-head"><h1>Blog</h1><p>Notes and write-ups. <a href="/rss.xml">RSS</a></p></div><ul class="list">${c.posts.map(postItem).join("")}</ul></div>`,
  });
  for (const p of c.posts) {
    page(`blog/${p.slug}/index.html`, {
      path: `/blog/${p.slug}/`,
      title: p.title,
      description: p.description,
      body: `<div class="narrow"><div class="page-head"><h1>${esc(p.title)}</h1><p><time class="date" datetime="${p.date}">${fmtDate(p.date)}</time> ${p.draft ? '<span class="draft-badge">draft</span>' : ""}</p>${tags(p.tags)}</div><article class="prose">${p.html}</article></div>`,
    });
    await copyAssets(files, p.assetDir, `blog/${p.slug}`);
  }

  page("404.html", {
    path: "/404.html",
    title: "Not found",
    description: "Page not found",
    body: `<div class="page-head"><h1>404</h1><p>The slime ate this page. <a href="/">Go home</a>.</p></div>`,
  });

  files.set("rss.xml", rss(c));
  const urls = [...files.keys()]
    .filter((f) => f.endsWith("index.html"))
    .map((f) => `<url><loc>${site.url}/${f.replace(/index\.html$/, "")}</loc></url>`);
  files.set(
    "sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
  );
  files.set("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`);
  files.set("favicon.svg", spriteSvg(false));
  files.set("og.png", ogPng());
  return files;
}
