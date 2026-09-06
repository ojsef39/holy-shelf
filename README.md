# Holy Shelf

Flavor lists for [holy.com](https://de.holy.com), as a browser extension.

Four lists: **Favorit**, **Mag ich**, **Nix für mich** — one rating per flavor,
mutually exclusive — plus **Später**, which is independent, because wanting to
buy a flavor later is not an opinion about how it tastes.

They live in a **Lists** tab the extension adds to your account page, next to
Rewards and Bestellungen.

> Not official. Holy Shelf is not affiliated with HOLY.

## How it works

`/pages/account` is a single page whose tabs are `<button data-account-tab="…">`
elements switching `<div data-account-panel="…">` panels via an `is-tab-hidden`
class. The extension joins that mechanism rather than fighting it: it clones a
tab's **list item** (so the tab gets its own slot and the theme's spacing) and
appends a panel alongside the theme's own. Tab switching then keeps working in
both directions, and nothing of the site's content is hidden by us.

`#lists` still addresses the tab, so the URL stays bookmarkable, and the mobile
"Mein Account" popover — whose entries are hash links, not tab buttons — gets a
cloned entry too.

Product data comes from the storefront's own `/products/<handle>.js`, so prices,
images and stock status are always current and nothing is scraped out of the DOM.

Ratings also show as badges on collection grid tiles and on the variant
swatches, so you can see what you have already judged without opening anything —
and a 1-Portion saved for later isn't hidden behind the 50-Portionen default.

**Storage.** Your verdicts live in `storage.sync` (Firefox Sync / Chrome sync),
keyed by flavor with no storefront prefix:

```
capybara-colada        a normal product — the flavor IS the product
3er-set::Grapefruit    a "Flavor" option — the flavor is the variant
```

Handles and flavor names are identical across `de.holy.com`, `fr.holy.com` and
`holy.com`, while product and variant IDs are not — `fr` is a separate Shopify
shop with different IDs for the same flavor. So keys travel, and your ratings
follow you between storefronts.

A **rating is about taste**, so it never splits across pack sizes: rate Kola
Koala once and the 10er shows it too. **Später is an intent to buy**, so it also
records which variant you chose — the shaker bundle is not the plain tub. That
variant is stored as data rather than in the key, because portion titles are
localized (`50 Portionen` is `50 Portions` on `fr`) and variant IDs are
per-shop; it resolves by ID, then by title, then falls back to the default.

Sync is quota-limited (~100 KB), so only verdicts go there. Product metadata is
cached separately in `storage.local`, keyed by host, since prices differ per
storefront.

**Language.** Resolved from the storefront's `<html lang>`, not the browser UI
language — otherwise an English Firefox would inject English strings into a
German page. English and German ship today; anything else falls back to English.
Message files are in `src/messages/` in `browser.i18n`'s `messages.json` shape.

## Develop

Requires [Nix](https://nixos.org). `nix develop` provides node and the scripts
below; each one installs from the lockfile on demand, so there is no separate
install step.

| command | what it does |
| --- | --- |
| `d-start` | loads the extension into Firefox and opens the account page |
| `d-lint` | alejandra, then `web-ext lint` |
| `d-build` | packages into `web-ext-artifacts/` |

`d-start` keeps its profile in `.dev-profile/`, so your holy.com login survives
between runs, and reloads the extension whenever a source file changes.

**On macOS, give your terminal Full Disk Access** — System Settings → Privacy &
Security → Full Disk Access — or Firefox can't read
`~/Library/Application Support/Firefox/profiles.ini` and fails with either
`EPERM` or "Your Firefox profile cannot be loaded". A Firefox launched from the
terminal inherits the terminal's permissions, so this is not optional.

Without that, load it by hand instead: `about:debugging` → This Firefox → Load
Temporary Add-on → pick `src/manifest.json`. No auto-reload, but identical code.

## Releases

Releases are automatic — **don't tag or bump versions by hand.** Push
[conventional commits](https://www.conventionalcommits.org) to `main` and
semantic-release does the rest:

| commit prefix | release |
| --- | --- |
| `fix:` | patch |
| `feat:` | minor |
| `feat!:` or `BREAKING CHANGE:` in the body | major |
| `chore:`, `docs:`, `refactor:` | none |

On release it writes the version into `src/manifest.json`, builds the package,
tags, and attaches the zip to a GitHub release.

`src/manifest.json` stays at `0.0.0` in git — the real version is written at
build time, so only published artifacts carry it.

One constraint worth knowing: manifest versions are **not** semver. Chrome wants
1–4 dot-separated integers up to 65535 and AMO rejects pre-release tags, so
`1.2.0-beta.1` would build a package no store accepts. `scripts/set-version.mjs`
fails the release rather than shipping one — which is also why there are no
prerelease branches configured.

Each release is also submitted to [addons.mozilla.org](https://addons.mozilla.org)
on the **listed** channel. AMO signs it — release Firefox refuses unsigned
extensions — and then serves updates itself, so nothing here hosts an `.xpi` or
maintains an `updates.json`.

Two repository secrets are needed, from AMO → Tools → Manage API Keys:

| secret | AMO calls it |
| --- | --- |
| `MOZ_JWT_ISSUER` | JWT issuer |
| `MOZ_JWT_KEY` | JWT secret |

Without them the release still happens and only the AMO submission is skipped,
so CI works before the account exists. The **first** version has to be uploaded
once through the AMO web UI, which is where the listing metadata (name,
summary, categories) is entered; every version after that is automatic.

## Install

Once it's on AMO, with `policy.json` — the same shape as any other add-on:

```nix
"holy-shelf@jhofer.de" = {
  name = "Holy Shelf";
  install_url = "https://addons.mozilla.org/firefox/downloads/latest/holy-shelf/latest.xpi";
  installation_mode = "force_installed";
};
```

The `holy-shelf` in that URL is the AMO slug, chosen at first submission —
adjust it if AMO assigns a different one. The id must stay
`holy-shelf@jhofer.de`, since that's what `manifest.json` declares and what
`storage.sync` is tied to.

## Layout

```
src/
  manifest.json
  icons/           generated from icon.png, gitignored (npm run icons)
  messages/        en.js, de.js — browser.i18n message shape
  lib/
    i18n.js        locale resolution + t()
    storage.js     versioned verdict store, keyed by handle
    shopify.js     /products/<handle>.js with a local cache
    icons.js
  content/
    account.js     the Lists tab and its panel
    product.js     the rating control + variant swatch badges
    collection.js  rating badges on collection grid tiles
    controls.js    the rating pill + "save for later" toggle
    shelf.css      all hs- prefixed
```

## Not yet

- [#1](https://github.com/ojsef39/holy-shelf/issues/1) — notify when something on
  your Später list is back in stock
- Custom lists beyond the four built-in ones. The control's second row is left
  free for them.
