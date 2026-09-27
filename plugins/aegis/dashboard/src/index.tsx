import { BootScreen } from "./BootScreen";
import { Hud } from "./Hud";
import { MissionControl } from "./MissionControl";

/**
 * AEGIS dashboard plugin entry.
 *
 *   tab      /mission   Mission Control (orb, agents, tasks, activity, telemetry)
 *   overlay  boot       one-shot boot plate on dashboard load
 *   overlay  hud        instrument chrome, revealed only by the AEGIS Amber theme
 */
const registry = (window as unknown as {
  __HERMES_PLUGINS__?: {
    register: (name: string, component: () => unknown) => void;
    registerSlot: (plugin: string, slot: string, component: () => unknown) => void;
  };
}).__HERMES_PLUGINS__;

if (registry) {
  registry.register("aegis", MissionControl);
  // One component per (plugin, slot) — the registry replaces on re-register —
  // so the two overlay pieces share a wrapper.
  registry.registerSlot("aegis", "overlay", function AegisOverlay() {
    return (
      <>
        <Hud />
        <BootScreen />
      </>
    );
  });
}
