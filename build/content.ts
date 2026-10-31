import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { Marked } from "marked";
import { createHighlighter, type Highlighter } from "shiki";
import { parse as parseYaml } from "yaml";

export interface SiteConfig {
  name: string;
  tagline: string;
  url: string;
  description: string;
  socials: { label: string; url: string }[];
  skills?: string[];
}

export interface Post {
  slug: string;
  title: string;
  date: string;
  description: string;
  tags: string[];
  draft: boolean;
  html: string;
  // Folder holding images etc. that ship next to the page, if the post is a folder.
  assetDir?: string;
}

// Project categories -> the label on their tag.
export const CATEGORIES = {
  research: "Research",
  personal: "Personal projects",
  hackathon: "Hackathons",
  course: "Course projects",
};

export interface Project {
  slug: string;
  title: string;
  category: keyof typeof CATEGORIES;
  summary: string;
  date: string;
  stack: string[];
  repo?: string;
  url?: string;
  image?: string;
  featured: boolean;
  html: string;
  assetDir?: string;
}

export interface Content {
  site: SiteConfig;
  cv: string;
  posts: Post[];
  projects: Project[];
}

const LANGS = [
  "ts",
  "tsx",
  "js",
  "jsx",
  "json",
  "html",
  "css",
  "bash",
  "shell",
  "python",
  "rust",
  "go",
  "c",
  "cpp",
  "java",
  "sql",
  "yaml",
  "toml",
  "markdown",
  "diff",
];

let highlighter: Promise<Highlighter> | null = null;

async function markdown(): Promise<Marked> {
  highlighter ??= createHighlighter({
    themes: ["catppuccin-latte", "catppuccin-mocha"],
    langs: LANGS,
  });
  const hl = await highlighter;
  return new Marked({
    renderer: {
      code({ text, lang }) {
        const known = lang && hl.getLoadedLanguages().includes(lang);
        return hl.codeToHtml(text, {
          lang: known ? lang : "text",
          themes: { light: "catppuccin-latte", dark: "catppuccin-mocha" },
          defaultColor: false,
        });
      },
    },
  });
}

export function splitFrontmatter(
  src: string,
  file: string,
): { data: Record<string, unknown>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
  if (!m) return { data: {}, body: src };
  const data = parseYaml(m[1]) ?? {};
  if (typeof data !== "object" || Array.isArray(data))
    throw new Error(`${file}: frontmatter must be a YAML map`);
  return { data, body: src.slice(m[0].length) };
}

function scalar(v: unknown, key: string, file: string): string {
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  throw new Error(`${file}: "${key}" must be plain text`);
}

function str(data: Record<string, unknown>, key: string, file: string, required = true): string {
  const v = data[key];
  if (v == null || v === "") {
    if (required) throw new Error(`${file}: missing "${key}" in frontmatter`);
    return "";
  }
  return scalar(v, key, file);
}

function list(data: Record<string, unknown>, key: string, file: string): string[] {
  const v = data[key];
  if (v == null) return [];
  return (Array.isArray(v) ? v : [v]).map((x) => scalar(x, key, file));
}

// A collection entry is either `<slug>.md` or `<slug>/index.md` (with assets alongside).
async function entries(dir: string): Promise<{ slug: string; file: string; assetDir?: string }[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const out = [];
  for (const name of names) {
    const path = join(dir, name);
    if ((await stat(path)).isDirectory()) {
      const file = join(path, "index.md");
      if (await stat(file).catch(() => null)) out.push({ slug: name, file, assetDir: path });
    } else if (name.endsWith(".md")) {
      out.push({ slug: name.slice(0, -3), file: path });
    }
  }
  return out;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function loadContent(root: string, { drafts = false } = {}): Promise<Content> {
  const md = await markdown();
  const read = (p: string) => readFile(p, "utf8");

  const site = parseYaml(await read(join(root, "site.yaml"))) as SiteConfig;
  site.url = site.url.replace(/\/$/, "");
  site.socials = (site.socials ?? []).filter((s) => s.url);

  const cv = await md.parse(splitFrontmatter(await read(join(root, "cv.md")), "cv.md").body);

  const posts: Post[] = [];
  for (const e of await entries(join(root, "blog"))) {
    const { data, body } = splitFrontmatter(await read(e.file), e.file);
    const post: Post = {
      slug: e.slug,
      title: str(data, "title", e.file),
      date: str(data, "date", e.file),
      description: str(data, "description", e.file, false),
      tags: list(data, "tags", e.file),
      draft: data.draft === true,
      html: await md.parse(body),
      assetDir: e.assetDir,
    };
    if (!DATE.test(post.date)) throw new Error(`${e.file}: date must be YYYY-MM-DD`);
    if (!post.draft || drafts) posts.push(post);
  }
  posts.sort((a, b) => b.date.localeCompare(a.date));

  const projects: Project[] = [];
  for (const e of await entries(join(root, "projects"))) {
    const { data, body } = splitFrontmatter(await read(e.file), e.file);
    const category = str(data, "category", e.file);
    if (!(category in CATEGORIES))
      throw new Error(`${e.file}: category must be one of ${Object.keys(CATEGORIES).join(", ")}`);
    projects.push({
      slug: e.slug,
      title: str(data, "title", e.file),
      category: category as Project["category"],
      summary: str(data, "summary", e.file, false),
      date: str(data, "date", e.file, false),
      stack: list(data, "stack", e.file),
      repo: str(data, "repo", e.file, false) || undefined,
      url: str(data, "url", e.file, false) || undefined,
      image: str(data, "image", e.file, false) || undefined,
      featured: data.featured === true,
      html: await md.parse(body),
      assetDir: e.assetDir,
    });
  }
  // Starred (featured) projects first, then newest first.
  projects.sort((a, b) => Number(b.featured) - Number(a.featured) || b.date.localeCompare(a.date));

  return { site, cv, posts, projects };
}
