# Design system: Learn in Public

Learn in Public is a family of seven roadmaps by Kushal Rana, plus a hub page that ties them together:

| Roadmap | Stack | Glyph in the logo tile |
|---|---|---|
| OOP All-in-One | Flask + Jinja | a cube (an object) |
| Python Projects | Flask + Jinja | a terminal prompt |
| ML 1 → 100 | Next.js | points around a fitted line |
| LLM 1 → 100 | Next.js | a chat bubble of tokens |
| RAG in 30 Days | Next.js | search with a spark |
| AI Engineer Path | Vite + React | a peak and a dot |
| System Learn | Vite + React | bars |
| *the hub* (learn-in-public) | Vite + React | a route between two dots |

They look and behave like one product. Someone who has used one should already know how to use the others. This is
the mark of the work: the same surfaces, one accent, the same type, the same page structure, the same switcher at the
top and the same signature at the bottom.

**The hub repo holds the reference copies of every shared file** (`learn-in-public/src/design/`). Change a shared file
there, then run `npm run check-family -- --sync` in the hub to copy it into every app, and re-test each app. System
Learn and LLM 1 → 100 keep the tokens inline in their own stylesheet; keep those values identical.

## The shared files

| File | What it holds |
|---|---|
| `design/tokens.css` | Every colour, radius, shadow, easing and font token, for dark (default) and light. |
| `design/base.css` | Base elements and the shared components: page shell, nav, buttons and fields, pills and meters, cards, hero, entry cards, chat widget, credit strip, React Flow canvas. |
| `design/roadmaps.js` | The family: the registry of roadmaps and stages, the `<kr-roadmaps>` switcher, the `<kr-next-roadmap>` block and shared progress. Framework-free. |
| `design/roadmaps.d.ts` | Types for `roadmaps.js`, including the JSX declarations for the two elements. |

They are byte-identical in every app (`src/design/` in the Vite apps, `app/design/` in the Next apps, `app/static/design/`
or `hub/static/design/` in the Flask apps). Each app's own stylesheet loads them first, then adds only what is
specific to that app. **Never fork them inside one app.** Never write a raw colour in a component: add a token.

## Look

- **Dark first.** `--bg #0a0c10`, panels step up in layers (`--bg-2`, `--panel`, `--panel-2`, `--panel-3`), hairline borders (`--line`, `--line-2`).
- **One accent: emerald** (`--accent #10b981`, `--accent-strong #34d399`). Used for actions, the active nav item, links, progress and the logo. Status colours (`--good`, `--warm`, `--hot`, `--bad`) carry meaning only; `--ai` marks AI features.
- **Light is a toggle**, not a default: `<html data-theme="light">`, same layout, emerald deepened for contrast. Code blocks stay dark in both themes.
- **Type:** Inter Variable for text, JetBrains Mono Variable for code. Body 14.5px. Headings tight (`letter-spacing -0.025em`), weight 650 to 700. Eyebrows are 0.72rem, uppercase, emerald.
- **Shape:** radii 8 / 12 / 16 (`--r-sm`, `--r`, `--r-lg`). Hover lifts a card 2px. One easing curve (`--ease`). Respect `prefers-reduced-motion`.

## Structure

1. **Top bar, 56px:** logo tile + name, main sections (icon + label; labels collapse below 1180px), then the
   **Roadmaps switcher** (`<kr-roadmaps>`), a spacer, then search, progress, theme toggle and the AI chip. Course
   outlines (module or day lists) sit **beside** lessons, never in the global nav.
2. **Page:** `eyebrow` → `h1` → `lead` → content, centred at 1120px (`.page`, `.page.narrow`, `.page.wide`).
3. **Home:** hero (eyebrow, heading with the word *building* in the emerald gradient via `<em>`, lead, primary +
   secondary button, stats row, animated diagram with three metric tiles), then "Four ways in" entry cards, then "How it
   works" steps. A returning learner also gets "Pick up where you left off" resume cards. Near the end: **"Where to go
   next"** (`<kr-next-roadmap>`), or, in the three LLM-stage apps, the "Which path should I take?" guide, which names
   the family stage it belongs to.
4. **Credit strip, 30px, every page:** "Built by Kushal Rana · Part of Learn in Public" and five icon links
   (portfolio, LinkedIn, X, Medium, YouTube). Below 560px it shortens to "Kushal Rana · Learn in Public".
5. **Logo:** the emerald rounded tile is the family mark. Each app keeps its own glyph inside it (table above; the
   glyphs live in `roadmaps.js`).

## Behaviour

- Local-first. Progress and notes live in `localStorage`. Keys never leave the machine.
- One next step is always visible; every lesson ends with where to go next, and every roadmap points to the next roadmap.
- Nothing is locked. The order of the roadmaps is a recommendation, and each one says who it is for ("You're ready if…").
- Responsive in width **and** height. No horizontal page scroll at 390px; wide content scrolls inside its own box.
- Keyboard first: visible focus ring (`--ring`), skip link, `Esc` closes overlays.

## Adding an app or a page

1. Copy the four shared files; load tokens, then base, then your own CSS; load `roadmaps.js` once on the client.
2. Reuse the classes: `page`, `eyebrow`, `lead`, `btn` (+ `primary`, `big`), `card`, `entry-grid`, `how-grid`, `pill`, `meter`, `hero`, `credit`.
3. Put `<kr-roadmaps current="<id>">` after the main nav links and `<kr-next-roadmap current="<id>">` near the end of Home.
4. Check dark **and** light, at 1440, 820 and 390px wide, before calling it done.

## Verifying

A page is on-brand when, side by side with System Learn, the nav height, heading size, card radius, button style,
accent colour, switcher and footer strip are indistinguishable. The quickest check is the home page at 1440 × 900.
