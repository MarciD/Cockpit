## What and why

<!-- What changes, and what problem it solves. Link an issue if there is one. -->

## How I verified it

<!-- cockpit has no test suite, so this section is what stands in for one. -->

- [ ] `pnpm exec prettier --check "**/*.{ts,tsx,mjs,md,json,yaml,yml}"`
- [ ] `pnpm check-types`
- [ ] `pnpm build` (with the dev server stopped)
- [ ] Drove the affected part of the app in a browser

<!-- Screenshots for anything visual. -->

## Checks

- [ ] No secret goes into widget `config` (it is client-visible)
- [ ] Widgets fetch only through `/api/*`
- [ ] Any URL fetched server-side is validated (`packages/integrations/src/net.ts`)
- [ ] Colours come from theme tokens, surfaces from `layerStyle`
- [ ] Docs updated if behaviour or configuration changed
