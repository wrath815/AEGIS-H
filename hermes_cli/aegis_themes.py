"""AEGIS theme pack — backend mirror of ``web/src/themes/aegis.ts``.

Label + description only; colours live in the web module. Kept in its own file
and appended to ``_BUILTIN_DASHBOARD_THEMES`` with one line so upstream merges
of ``web_server_dashboard.py`` stay trivial.
"""

AEGIS_DASHBOARD_THEMES = [
    {"name": "aegis-obsidian",  "label": "AEGIS Obsidian",  "description": "Quiet charcoal, sage accents, room to think."},
    {"name": "aegis-porcelain", "label": "AEGIS Porcelain", "description": "Warm paper, clear type and deep forest green."},
    {"name": "aegis-midnight",  "label": "AEGIS Midnight",  "description": "Deep navy with cool blue signals."},
    {"name": "aegis-amber",     "label": "AEGIS Amber",     "description": "The original mission-control look — amber on black, with the HUD."},
    {"name": "aegis-regalia",   "label": "AEGIS Regalia",   "description": "Gold lettering on deep burgundy, with Great Vibes calligraphy."},
    {"name": "aegis-sandstone", "label": "AEGIS Sandstone", "description": "Warm paper and terracotta, set in a refined serif."},
    {"name": "aegis-nebula",    "label": "AEGIS Nebula",    "description": "Deep violet with cyan signals — the mission-control lane."},
]
