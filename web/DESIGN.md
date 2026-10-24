# Design notes

How the web app is meant to look and behave, and why. Read this before adding a page or a component.

The app is a sibling of the [Machine Learning 1 → 100](https://github.com/KushalranaAI/machine-learning-1-to-100) app:
same shell, components, tokens and interaction patterns, with a cyan accent instead of indigo. A learner who has used
one should already know how to use the other (Jakob's law). Keep it that way: when you improve a shared pattern
here, consider porting it there.

## Product principles

1. **The Markdown is the source of truth.** Every lesson, project, command and exercise comes from the READMEs
   (`lib/content.ts`). The app adds no content of its own except the technique map, the lab widgets and UI copy. If
   something is wrong in the app, fix the README.
2. **One next step, always visible.** The dashboard leads with "Continue", every lesson step ends with "Next: …",
   and the last step marks the day complete and points to tomorrow.
3. **Learn by doing, then measure.** Each day moves from reading to trying (lab widget) to running real code to an
   exercise. The evaluation widget and the tutor's prompt both push "change one thing, measure it" (Day 14).
4. **Local-first and private.** Progress, notes and quiz scores live in `localStorage`; API keys stay in `.env` on
   the learner's machine and are attached server-side (`server/ai-relay.ts`). The server binds to `127.0.0.1`.

## UX principles and where they show up

| Principle | Source | In this app |
|---|---|---|
| Progressive disclosure | NN/g | A lesson shows one step at a time (Overview → … → Notes); code from `rag_common` and long command lists sit in collapsed `<details>`. |
| Recognition rather than recall | NN/g heuristic 6 | `Ctrl K` palette searches days, techniques and projects; the technique map starts from symptoms, not jargon; days are labelled "Day 08" everywhere, as the course does. |
| Visibility of system status | NN/g heuristic 1 | Progress rings per week, sidebar status icons, reading-progress bar, live run output with an elapsed timer, "Saving…/Saved" on notes. |
| User control and freedom | NN/g heuristic 3 | Run arguments are editable and resettable; runs can be stopped; tabs are reachable from the URL hash; progress can be exported, imported and reset. |
| Error prevention and recovery | NN/g heuristics 5 and 9 | The Run API warns before running without `ANTHROPIC_API_KEY`, explains a missing package in one line, and only offers commands that make sense in a browser (no servers, placeholders or interactive sessions). |
| Consistency and standards | NN/g heuristic 4, Jakob's law | One token set (`app/globals.css`), one icon set (`components/ui/Icon.tsx`), the same card / pill / button vocabulary on every page. |
| Hick's law | Laws of UX | Fifteen projects and 24 techniques are filterable; the dashboard shows three "up next" items, not thirty. |
| Chunking / Miller's law | Laws of UX | Thirty days grouped into four weeks; each week shows its path ("embeddings → loading → chunking …"). |
| Fitts's law | Laws of UX | Primary actions are large (`.btn.lg`) and sit where the eye ends: the bottom of each step, the hero. |
| Cognitive load | Sweller; e-learning UX research | One section per screen, short helper text above each tool, explanations under each widget instead of in a manual. |

## Accessibility (WCAG 2.2 AA)

- Text and controls meet 4.5:1 contrast in both themes (`--brand` `#0e7490` on white is 5.4:1; white on
  `--brand-solid` likewise). Colour is never the only signal: rings show numbers, status icons have labels.
- Targets are at least 24×24 px (2.5.8); most buttons are 40 px high.
- The sticky top bar and lesson stepper must not hide focused elements (2.4.11): headings get `scroll-margin-top`.
- Everything works by keyboard: skip link, arrow keys in the stepper, `Esc` closes overlays, focus returns to the
  trigger after the palette closes.
- `prefers-reduced-motion` turns animations off; `prefers-color-scheme` picks the theme unless the learner chooses.
- No horizontal page scroll at 390 px. Wide content (code, tables, the stepper) scrolls inside its own box.

## Adding things

- **A lab widget:** port the algorithm into `lib/rag.ts` with a test against the Python output, add a component in
  `components/widgets/`, register it in `components/widgets/index.tsx` with the days it belongs to. It then appears
  in the lab and in those days' "Try it" step.
- **A technique:** add a row to `lib/techniques.ts`. Only link days whose README actually teaches it.
- **Colours:** add a token in `:root` and `[data-theme="dark"]`; never a raw colour in a component.

## Sources

- Nielsen Norman Group: [10 usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/), [Progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- [Laws of UX](https://lawsofux.com/) (Jakob's, Hick's, Fitts's and Miller's laws)
- W3C: [What's new in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)
- ALT: [Improving UX in large-scale online courses](https://altc.alt.ac.uk/blog/2026/02/from-overwhelmed-to-engaged-improving-ux-in-large%e2%80%91scale-online-courses-at-altc/) (cognitive load, one section per page)
