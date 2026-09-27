import { contrastRatio } from "@hermes/shared";
import { describe, expect, it } from "vitest";

import { AEGIS_THEMES } from "./aegis";
import { BUILTIN_THEMES } from "./presets";

// The AEGIS pack maps its own tokens onto the dashboard slots. These assert the
// relationships that keep a theme usable — body text, accents and text on an
// accent fill all stay legible on the surfaces they're drawn on — not any
// particular colour value, so retuning a palette never trips them.
describe("AEGIS theme pack", () => {
  const themes = Object.values(AEGIS_THEMES);

  it("ships as dashboard built-ins", () => {
    for (const theme of themes) expect(BUILTIN_THEMES[theme.name]).toBe(theme);
  });

  it.each(themes.map(t => [t.name, t] as const))("%s: text and accents stay legible", (_name, theme) => {
    const bg = theme.palette.background.hex;
    const o = theme.colorOverrides!;
    expect(contrastRatio(theme.palette.midground.hex, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(o.mutedForeground!, o.card!)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(o.primary!, bg)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(o.primaryForeground!, o.primary!)).toBeGreaterThanOrEqual(4.5);
  });
});
