---
name: write-content
description: Interactively write content for this personal site — a blog post, a project page, or a CV update — by interviewing Mark, drafting, and revising together until he approves. Use when he wants to write/draft a post, add or update a project, update the CV or site.yaml, or says "let's write something".
---

# Write content for the site

You are co-writing with Mark. He talks, you ask, you draft, he steers. The words should sound like him, not like you.

Before starting, read the "This site" section of `AGENTS.md` (content layout, frontmatter, and the **Voice** notes). That is the source of truth for file paths and fields; don't restate or invent fields.

## 1. Pick the kind of content

If it isn't obvious from his message, ask which one:

- **Blog post** → `content/blog/<slug>/index.md`
- **Project** → `content/projects/<slug>/index.md` (folder form, so images can sit next to it)
- **CV** → edit `content/cv.md` in place
- **Site info** (name, tagline, socials) → edit `content/site.yaml` in place

For an edit, read the existing file first and work from what's there.

## 2. Interview in rounds

Ask a few questions per round (number them, 2–5 at a time), wait for answers, then ask the next round based on what he said. Finding facts is your job: if the answer is in the repo (e.g. a project's README, its stack from `package.json`, the git log), look it up instead of asking.

What to draw out:

- **Post:** what happened or what he learned, who it's for, the one thing a reader should leave with, concrete details (numbers, errors, code, screenshots), what surprised him, and how it ends.
- **Project:** what it does in one line, why he built it, his role, the stack, the hardest problem and how he solved it, results, links (repo, live demo), an image if any, and whether it's `featured`.
- **CV entry:** role, organisation, dates, place, and 2–4 achievements with impact (push for numbers: "faster by how much?", "how many users?").

Stop interviewing when you could write the piece without guessing. Don't pad with questions you don't need.

## 3. Draft

- Write the file with `draft: true` for posts. Pick a short lowercase-hyphenated slug and confirm it, since it becomes the URL.
- Use his words and phrasing from the interview wherever possible. Follow the Voice notes in `AGENTS.md`.
- Keep it tight: short paragraphs, concrete over generic, no filler intros ("In today's fast-paced world…") or summary outros.
- Code blocks get a language tag. Images go in the same folder, linked relatively.
- Never invent facts, numbers, links, or dates. If something's missing, leave a visible `TODO:` and ask.

## 4. Revise together

Show him the draft (or the diff for an edit) and ask what to change. Iterate until he says it's good. Offer `vp dev` to preview it at `/blog/<slug>/`, `/projects/<slug>/`, or `/cv/` — drafts show there with a DRAFT badge.

Before calling it done, run `vp build` to make sure the frontmatter is valid (the build fails on missing `title`/`date` or a bad date).

## 5. Publish (only when he says so)

- For a post, flip `draft: true` → `draft: false` (or remove the line).
- Commit with a message like `Add post: <title>` / `Add project: <title>` / `Update CV`, then push. Pushing to `main` deploys the site.
- Don't commit or push without his go-ahead.

## Learn his voice

If the Voice section in `AGENTS.md` is empty or thin, after the first piece is approved ask whether to record what you learned about how he writes (tone, person, sentence length, words he likes or avoids) and add it there, so future sessions start with it.
