# AEGIS-H

AEGIS-H is [Hermes Agent](https://github.com/NousResearch/hermes-agent) (MIT) with the AEGIS
layer on top: Mission Control, the AEGIS theme pack, the boot screen and the particle orb.

Hermes supplies the engine: model and provider selection, custom endpoints, context-window
management and compression, skills, plugins, MCP, the messaging gateway, cron, kanban and
profiles. The AEGIS layer only adds to that. It lives in its own files and touches upstream code
in two one-line hooks, so you can keep merging Hermes updates.

## What the AEGIS layer is

| Path | What it does |
|---|---|
| `plugins/aegis/dashboard/` | Dashboard plugin: the **Mission Control** tab (`/mission`), the boot screen and the HUD overlay |
| `web/src/themes/aegis.ts` | The seven AEGIS themes (Obsidian, Porcelain, Midnight, Amber, Regalia, Sandstone, Nebula) |
| `web/src/themes/aegis-fonts.css`, `web/src/themes/fonts/` | Self-hosted Great Vibes and IM Fell English for Regalia (SIL OFL, unmodified, licences included) |
| `web/src/themes/aegis.test.ts` | Legibility checks for every AEGIS theme |
| `hermes_cli/aegis_themes.py` | Backend list of the AEGIS themes, so the theme picker shows them |
| `web/src/themes/presets.ts` | **Upstream file, 2-line hook:** spreads `AEGIS_THEMES` into `BUILTIN_THEMES` |
| `hermes_cli/web_server_dashboard.py` | **Upstream file, 3-line hook:** appends the AEGIS themes to `_BUILTIN_DASHBOARD_THEMES` |

Those two hooks are the only places an upstream merge can conflict. If one does, keep
upstream's version and re-add the hook line.

### Mission Control

Mission Control reads only APIs that Hermes already serves, so it needs no backend of its own.

- **Overview:** the orb. It moves faster and pulls tighter while a session is live or a kanban
  task is running. It uses three.js through WebGL, and falls back to a 2D canvas sphere on
  machines without WebGL.
- **Agents:** your Hermes profiles, each with its own model and skills. A profile shows as
  Working when a running task is assigned to it.
- **Tasks:** the kanban board, grouped into Queued / In progress / Done.
- **Activity:** recent sessions with model, token and tool counts.
- **Status strip:** model, context window, tokens and cost today (from Hermes' analytics), CPU,
  memory, disk and gateway state.

Each data source loads on its own. If one call fails, only its tiles go blank.

### Themes

To pick a theme, open the dashboard's theme switcher and choose an **AEGIS …** theme. Only
**AEGIS Amber** turns on the HUD overlay (grid, scanlines, sweep and corner ticks). The boot screen
and Mission Control take their colours from whichever theme is active, including the stock
Hermes ones.

## Run it (Windows, PowerShell)

```powershell
cd $HOME\Desktop\AEGIS-H
. .\activate.ps1          # first run provisions Python + tools, then activates
hermes setup              # pick providers/models, add keys (skip if already set up)
hermes dashboard          # builds the web UI and opens http://127.0.0.1:9119
```

Mission Control is in the sidebar under the plugin tabs. You can turn the boot screen off from
Mission Control → the options button (top right).

> The dashboard is the surface that has Mission Control and the AEGIS themes. The separate Hermes
> desktop app (`apps/desktop`) has its own UI, and porting the AEGIS layer there is a follow-up.

## Rebuild the plugin after editing it

```powershell
npm --prefix plugins\aegis\dashboard install
npm --prefix plugins\aegis\dashboard run build       # -> dist/index.js + dist/style.css
npm --prefix plugins\aegis\dashboard run typecheck
```

`dist/` is committed, as with the other bundled dashboard plugins, so users never need the build
step. React is never bundled: the plugin uses the dashboard's own React through the plugin SDK.
three.js is bundled so the orb works offline.

## Pull in Hermes updates

```powershell
git fetch upstream
git merge upstream/main          # conflicts, if any, are limited to the two hook lines above
```

This checkout is shallow (depth 1). The first merge works as-is. Run `git fetch --unshallow upstream`
once if you want the full history.
