# aegis — Mission Control for the Hermes dashboard

This plugin adds the Mission Control tab (`/mission`), the AEGIS boot screen and the HUD overlay
to `hermes dashboard`. The theme pack lives in `web/src/themes/aegis.ts`. See the repo's
`AEGIS.md` for the whole fork layer.

- `dashboard/src/`: the TypeScript/TSX sources
- `dashboard/dist/`: the built bundle that the dashboard loads (committed)
- `dashboard/build.mjs`: the esbuild script (`npm run build`)

The plugin talks to the dashboard only through `window.__HERMES_PLUGIN_SDK__`, using the host's
React and API client, plus the kanban plugin's `/api/plugins/kanban/board`. It changes nothing in
Hermes core.

The three.js bundle is © 2010-2024 three.js authors and MIT-licensed.
