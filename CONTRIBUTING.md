# Contributing

## Local setup

1. `pnpm install`
2. `pnpm dev` — starts WXT's dev server, building to `.output/chrome-mv3-dev` and rebuilding on save.
3. Load it as an unpacked extension: `chrome://extensions` → enable Developer Mode → **Load unpacked** → select `.output/chrome-mv3-dev`.
4. Open an Actual Budget instance in a tab (self-hosted, or [app.actualbudget.org](https://actualbudget.org)) and set its URL from the extension's popup if it doesn't detect it automatically.

`pnpm dev:firefox` / `pnpm build:firefox` exist for Firefox, loaded via `about:debugging` → **This Firefox** → **Load Temporary Add-on**.

## Adding a feature

Scaffold it — this creates the setting file and registers it in `src/features/index.ts` for you:

```
pnpm new-feature <category> <kebab-name> "<Label>" <checkbox|select|custom> [--component]
```

For the full walkthrough, the architecture behind `defineSetting()`/the runtime/the Actual API bridge, and the conventions this codebase expects (page-gating, cleanup, selector fragility, commit style), see the website docs:

- **[Contributing walkthrough](https://abt.alexis.lol/docs/contributing)**
- **[Architecture](https://abt.alexis.lol/docs/architecture)**

## Before opening a PR

Run `pnpm format && pnpm check && pnpm lint` — CI runs the same checks (plus both builds) on every PR. Test against a real Actual instance; none of those checks catch a selector that stopped matching or a popover that doesn't close.
