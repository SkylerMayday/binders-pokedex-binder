# Pokédex Binder — Public Page (GitHub Pages)

These files are the GitHub Pages site for the public Pokédex Binder viewer.

**Deployment:** push the CONTENTS of this directory (`index.html`, `styles.css`, `app.js`) to
the root of the `SkylerMayday/binders-pokedex-binder` repository on branch `main`, with GitHub Pages
configured to serve from the repo root.

`binder.json` and `changelog.json` at that repo's root are written directly by the app's
Publish action (via the GitHub Contents API) — they are the live data files. **Do not commit
sample copies of `binder.json`/`changelog.json` as the source of truth** in that repo; they
will be overwritten by the next publish anyway, and committing stale copies risks confusing a
future diff.

`sample-binder.json` and `sample-changelog.json` in this directory are for local preview only
(so the page renders something before the first-ever publish, or when opened via `file://`
during development). `app.js` fetches `binder.json`/`changelog.json` first and falls back to
the `sample-*` files only on a 404/fetch failure.

P2 (not implemented here) will add a `CNAME` file for a custom domain.
