# Security policy

## Reporting a vulnerability

Please **don't open a public issue** for a security problem. Use **Security → Report a vulnerability** on this
repository's GitHub page, which opens a private report only the maintainer can see. Include what you found, how to
reproduce it and, if you can, what you think the impact is. You'll get an answer as soon as the maintainer can.

## What this project does that is worth knowing

This is a course you run **on your own computer**, plus a read-only copy of its web app on GitHub Pages.

- **Run buttons execute code.** The web app's `/api/run` route runs lesson and project scripts with your local Python.
  It only runs `.py` files inside `days/`, `projects/` and `data/`, only accepts requests addressed to `localhost`,
  `127.0.0.1` or `[::1]`, rejects cross-origin requests and limits the number and length of arguments. Scripts get
  a single blank line on standard input (so interactive prompts end) and are stopped after 15 minutes. `start.py` listens on `127.0.0.1` only. Don't expose the
  app to a network or the internet, and don't start it with `--hostname 0.0.0.0`.
- **The hosted copy is static.** The GitHub Pages site is plain files: there is no server, nothing executes on the
  host, and the `/api/run` and `/api/ai-server` routes do not exist there. Visitors' progress, notes and AI keys stay
  in their own browser.
- **Your Anthropic API key stays on your computer.** The lessons read `ANTHROPIC_API_KEY` from `.env` (git-ignored).
  The local web app's AI tutor can use the same key through `web/server/ai-relay.ts`, which attaches it on the server:
  the key is never sent to the browser or bundled into JavaScript. The relay only calls fixed provider URLs, only
  answers requests from the local page (Host must be localhost, any Origin must match, POSTs need a custom header),
  reports configured providers as booleans only, and strips echoed keys from error messages.
- **Keys saved in the browser are encrypted.** If you paste a key into the tutor's settings instead, it is stored only
  as an AES-256-GCM envelope (`web/lib/ai/vault.ts`), protected by a non-extractable device key or a passphrase.
  Script already running in the page, or someone using your unlocked browser, could still use it: prefer keys with a
  spending limit.
- **Content-Security-Policy.** Pages limit where scripts load from and where data can be sent: only this app, the
  supported AI providers and servers on this computer. The hosted copy allows only its own inline scripts, by hash.
  The local app also refuses to be shown in another site's frame (`frame-ancestors 'none'`).
- **The course code talks to outside services when you run it**: the Claude API, and in some lessons and projects
  web pages, arXiv or web search. Read a script before pointing it at private data, and use the read-only SQL, guardrail and
  least-privilege tool patterns from Days 26 and 29 and Project 13 in anything you deploy.

## For contributors

- Never commit API keys, tokens or `.env` files. `.gitignore` covers the common cases, but check your diff.
- If a key is ever committed, revoke it at the provider first; removing it from git history is not enough.
- `main` is protected: changes arrive through reviewed pull requests, and CI (`python`, `web`) must pass.
