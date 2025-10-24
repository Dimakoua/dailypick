# Daily Pick

Daily Pick is a collection of lightweight web experiences and supporting automation designed to make remote stand‑ups, retrospectives, and team rituals more engaging. The site is generated with Eleventy, deployed on Cloudflare Workers, and ships several multiplayer-friendly mini games.

## Quick Start
- `npm install` – install dependencies
- `npm run build` – generate the static site into `dist/`
- `npm run dev` – run the Cloudflare Worker locally with Wrangler (includes static assets from `dist/`)
- `npm run deploy` – publish the worker to production (requires configured credentials)

## Project Structure
```
apps/                 # Standalone mini-game front-ends copied straight to dist/apps/*
  ballgame/
  gravity-drift/
  letters/
  mimic-master/
  speedway/
  trap/
  wheel/
assets/               # Shared static assets (favicons, CSS, JS, OG images)
content/blog/         # Eleventy content: layouts, data, prompt template, Markdown posts
dist/                 # Eleventy build output (generated)
packages/
  shared/             # Shared Worker utilities and Durable Object implementations
  worker/             # Cloudflare Worker entrypoint and routing
public/               # Passthrough static files (e.g., sitemap template)
wrangler.toml         # Cloudflare deployment configuration
```

## Blog Content Workflow
- Markdown posts live in `content/blog/posts/`. Each file is routed to `/blog/<slug>/`.
- Default metadata and layouts are defined in `content/blog/_data` and `_includes`.
- The GitHub Actions workflow `.github/workflows/generate-blog-post.yml` generates scheduled posts by templating `content/blog/prompt.md` and saving new drafts to the posts directory.

## Cloudflare Worker
- Entry file: `packages/worker/worker.js`
- Durable Objects:
  - `CollaborationSession` – manages cross-game cursor state
  - `BallGameSession` – real-time physics session for Momentum Mayhem
  - `MimicGameSession` – room state for Mimic Master
- Update Worker logic alongside any associated game code in `apps/<game>/` to keep protocol and UI changes synchronized.

## Conventions
- Treat `dist/` as disposable build output and avoid committing manual edits.
- Shared front-end assets should live under `assets/` (e.g., `assets/css`, `assets/js`).
- When adding a new game, place its static files inside `apps/<game>/` and register any Worker routes or Durable Objects from `packages/worker/worker.js`.
- Blog posts should include canonical URLs (`https://dailypick.dev/blog/<slug>/`) and descriptive SEO front matter.
- Shared theming primitives (color, typography, layout) live in `assets/css/theme.css`; game-specific styles should prefer CSS custom properties like `--brand-accent` to inherit future branding config.

## Deployment Notes
- The Eleventy build runs as part of the scheduled blog workflow to refresh `sitemap.xml`.
- `wrangler.toml` points to `dist/` as the static bucket; ensure `npm run build` succeeds before deploying.
- Secrets for the blog generation workflow (e.g., `GEMINI_API_KEY`) must be managed in the GitHub repository settings.
