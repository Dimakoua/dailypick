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
  planning-poker/
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
- `PlanningPokerSession` – multiplayer Fibonacci voting with reveal/reset controls
- Update Worker logic alongside any associated game code in `apps/<game>/` to keep protocol and UI changes synchronized.

## Planning Poker Hub
- Front-end location: `apps/planning-poker/` served at `/apps/planning-poker/`.
- WebSocket endpoint: `/api/planning-poker/websocket?session_id=<code>` backed by the `PlanningPokerSession` Durable Object.
- Host workflow: first person in a room becomes host (auto-fails over if they disconnect).
- Features: Fibonacci deck, hidden picks until reveal, room story label, automatic vote summaries (counts + averages) that can be copied into Jira or any backlog tool.
- Rounds: reveal locks in results; “New round” clears selections and increments the internal round counter.

## Capacity Planner Dice
- Static game served from `apps/capacity-dice/` (no backend).
- Lets teams enter a planned capacity, roll thematic dice (availability, boosts, wildcards), and see the resulting percent adjustment.
- Generates a ready-to-copy summary plus keeps a short history of recent rolls for meeting notes.

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

## Brainstorming & Future Concepts

Here are some potential new games and tools being considered for Daily Pick, aligned with the goal of making team rituals more engaging and fair.

*   **Anonymous Feedback Box / "Venting Machine"**:
    *   **Concept**: A real-time, anonymous message board for retrospectives. Team members submit feedback cards that appear on a shared screen, fostering candid discussion.
    *   **Tech**: Would use a new `FeedbackSession` Durable Object to manage and broadcast messages.

*   **Team Morale Thermometer**:
    *   **Concept**: A quick polling tool where team members anonymously rate their energy/morale on a visual scale. The results are displayed as an aggregated "thermometer."
    *   **Tech**: Could extend the `CollaborationSession` DO or use a new, lightweight `PollSession` DO.

*   **"Two Truths and a Lie" Icebreaker**:
    *   **Concept**: A multiplayer version of the classic icebreaker. The game manages submissions, voting, and scoring, creating a structured and fun team-building activity.
    *   **Tech**: Would require a new `IcebreakerSession` Durable Object to handle the game state, turns, and votes.

*   **Collaborative Story Builder**:
    *   **Concept**: A creative writing game where each person adds one sentence to a story, only seeing the previous line. The full, often humorous, story is revealed at the end.
    *   **Tech**: A simple DO could manage the story array and turn-based submissions.

These ideas aim to address specific team needs (psychological safety, morale checks, icebreakers) while fitting into the existing fun, lightweight, and multiplayer-friendly architecture of the project.
