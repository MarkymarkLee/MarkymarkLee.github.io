<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

# This site

Static personal site, deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`. `build/plugin.ts` renders everything in `content/` into HTML pages (served from memory in `vp dev`, written to `dist/` by `vp build`). The home-page slime lives in `src/slime/`.

## Content layout

- `content/site.yaml` — name, tagline, description, site URL, socials (an empty `url` hides a social).
- `content/cv.md` — the CV. A role is an `###` heading followed by an italic line (`_2024 – Present · City_`) for dates/place. Browser print (Ctrl/Cmd+P) gives a clean A4 layout; no page limit.
- `content/projects/<slug>.md` or `content/projects/<slug>/index.md` (folder form when it has images next to it).
- `content/blog/<slug>.md` or `content/blog/<slug>/index.md`.

## Writing a post

1. Create `content/blog/<slug>/index.md`. The slug is the URL: `/blog/<slug>/`. Use lowercase-hyphenated slugs.
2. Frontmatter:

   ```yaml
   ---
   title: Post title # required
   date: 2026-10-20 # required, YYYY-MM-DD
   description: One sentence for the list, RSS and link previews.
   tags: [tag-one, tag-two]
   draft: true # leave true while writing; remove (or false) to publish
   ---
   ```

3. Put images in the same folder and link them relatively: `![alt text](diagram.png)`.
4. Code blocks get Catppuccin highlighting at build time; tag them with a language (` ```ts `).
5. Preview with `vp dev` (drafts show with a DRAFT badge locally; they are never built).
6. Publish: set `draft: false`, commit, `git push`. Only someone with push access to the repo can publish.

## Project frontmatter

```yaml
---
title: Project name # required
summary: One line shown on cards.
date: 2026-10-20 # used for ordering
stack: [TypeScript, Rust]
repo: https://github.com/...
url: https://... # live demo
image: cover.png # relative to the project folder, or an absolute URL
featured: true # also listed on the home page
---
```

## Voice

<!-- TODO: describe how posts should sound (e.g. casual, first person, short paragraphs, no filler). -->
