import { useCallback, useEffect, useMemo, useState } from "react";

import { api, fetchJSON } from "./sdk";
import { Orb } from "./Orb";
import { BOOT_PREF_KEY } from "./BootScreen";
import { Icon, type IconName } from "./icons";

/**
 * Mission Control — the AEGIS orchestration room, rebuilt on Hermes' own APIs.
 *
 *   Overview  the orb, energised while any session is live or a kanban task
 *             is running.
 *   Agents    Hermes profiles (each profile is an agent with its own model,
 *             skills and soul), marked working when a running task is assigned
 *             to them or their gateway is up.
 *   Tasks     the kanban board collapsed into Queued / In progress / Done.
 *   Activity  recent sessions, newest first.
 *
 * A resource strip carries the live model, context window, today's tokens and
 * cost, and host telemetry. Every source is optional: a failed call blanks its
 * own tiles and nothing else, so the room degrades rather than breaks.
 */

// ── Data ────────────────────────────────────────────────────────────────────

interface Status { active_sessions?: number; gateway_running?: boolean; version?: string }
interface ModelInfo { model?: string; provider?: string; effective_context_length?: number }
interface SystemStats {
  cpu_percent?: number; cpu_count?: number | null;
  memory?: { total: number; used: number; percent: number };
  disk?: { total: number; used: number; percent: number };
}
interface Session {
  id: string; title: string | null; model: string | null; source: string | null;
  last_active: number; is_active: boolean; input_tokens: number; output_tokens: number;
  message_count: number; tool_call_count: number;
}
interface Profile { name: string; display_name?: string; description: string; model: string | null; provider: string | null; skill_count: number; gateway_running: boolean; is_default: boolean }
interface KanbanTask { id: string; title: string; assignee: string | null; status: string; created_at: number; started_at: number | null; completed_at: number | null; consecutive_failures?: number }
interface Board { columns: { name: string; tasks: KanbanTask[] }[] }
interface Analytics { totals?: { total_input: number; total_output: number; total_estimated_cost: number; total_actual_cost: number; total_api_calls: number } }

interface Snapshot {
  status?: Status; model?: ModelInfo; system?: SystemStats; sessions?: Session[];
  profiles?: Profile[]; board?: Board | null; analytics?: Analytics;
}

const POLL_MS = 5000;

/** Settle every source independently; one failure never blanks the room. */
async function loadSnapshot(): Promise<Snapshot> {
  const pick = <T,>(r: PromiseSettledResult<T>) => (r.status === "fulfilled" ? r.value : undefined);
  const [status, model, system, sessions, profiles, board, analytics] = await Promise.allSettled([
    api.getStatus(),
    api.getModelInfo(),
    api.getSystemStats(),
    api.getSessions(25, 0, undefined, "recent"),
    api.getProfiles(),
    fetchJSON<Board>("/api/plugins/kanban/board"),
    api.getAnalytics(1),
  ]);
  return {
    status: pick(status),
    model: pick(model),
    system: pick(system),
    sessions: (pick(sessions) as { sessions?: Session[] } | undefined)?.sessions,
    profiles: (pick(profiles) as { profiles?: Profile[] } | undefined)?.profiles,
    // null = kanban plugin unavailable (disabled or not installed), distinct from "empty board".
    board: board.status === "fulfilled" ? (board.value as Board) : null,
    analytics: pick(analytics),
  };
}

function useSnapshot() {
  const [snap, setSnap] = useState<Snapshot>({});
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    const next = await loadSnapshot();
    setSnap(next);
    setLoaded(true);
  }, []);
  useEffect(() => {
    let timer = 0;
    let alive = true;
    const tick = async () => {
      // Don't poll a hidden tab; catch up the moment it's visible again.
      if (!document.hidden) await refresh().catch(() => {});
      if (alive) timer = window.setTimeout(tick, POLL_MS);
    };
    const onVisible = () => { if (!document.hidden) void refresh().catch(() => {}); };
    void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => { alive = false; window.clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [refresh]);
  return { snap, loaded };
}

// ── Formatting ──────────────────────────────────────────────────────────────

type Lane = "queued" | "running" | "done";
const LANE_OF: Record<string, Lane> = {
  triage: "queued", todo: "queued", scheduled: "queued", ready: "queued", blocked: "queued",
  running: "running", review: "running", done: "done",
};
const LANES: { id: Lane; label: string }[] = [
  { id: "queued", label: "Queued" }, { id: "running", label: "In progress" }, { id: "done", label: "Done" },
];

function ago(epochSeconds: number | null | undefined): string {
  if (!epochSeconds) return "";
  const s = Math.max(0, Date.now() / 1000 - epochSeconds);
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}
const gb = (bytes: number | undefined) => (bytes ? (bytes / 1024 ** 3).toFixed(1) : "—");
function tokens(n: number | undefined): string {
  if (n === undefined) return "—";
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}
const money = (n: number | undefined) => (n === undefined ? "—" : n < 0.01 && n > 0 ? "<$0.01" : `$${n.toFixed(2)}`);

// ── Preferences ─────────────────────────────────────────────────────────────

type Tab = "overview" | "agents" | "tasks" | "activity";
const TAB_KEY = "aegis.mission.tab.v1";
const MOTION_KEY = "aegis.mission.motion.v1";
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "overview", label: "Overview", icon: "radar" },
  { id: "agents", label: "Agents", icon: "users" },
  { id: "tasks", label: "Tasks", icon: "kanban" },
  { id: "activity", label: "Activity", icon: "activity" },
];

function readPref(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function writePref(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* private window */ }
}

// ── View ────────────────────────────────────────────────────────────────────

export function MissionControl() {
  const { snap, loaded } = useSnapshot();
  const [tab, setTabState] = useState<Tab>(() => {
    const t = readPref(TAB_KEY, "overview");
    return TABS.some(x => x.id === t) ? (t as Tab) : "overview";
  });
  const setTab = (t: Tab) => { setTabState(t); writePref(TAB_KEY, t); };
  const [motionPref, setMotionPref] = useState(() => readPref(MOTION_KEY, "on") !== "off");
  const [bootPref, setBootPref] = useState(() => readPref(BOOT_PREF_KEY, "on") !== "off");
  const [panelOpen, setPanelOpen] = useState(false);

  const reduceMotion = useMemo(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false, []);
  const motion = motionPref && !reduceMotion;

  const online = Boolean(snap.status);
  const tasks = useMemo(() => (snap.board?.columns ?? []).flatMap(c => c.tasks.map(t => ({ ...t, status: c.name }))), [snap.board]);
  const board = useMemo(() => {
    const cols: Record<Lane, KanbanTask[]> = { queued: [], running: [], done: [] };
    for (const t of tasks) { const lane = LANE_OF[t.status]; if (lane) cols[lane].push(t); }
    return cols;
  }, [tasks]);
  const working = useMemo(() => new Set(board.running.map(t => t.assignee).filter(Boolean) as string[]), [board]);
  const liveSessions = snap.status?.active_sessions ?? 0;
  const orbActive = liveSessions > 0 || board.running.length > 0;

  const sessions = snap.sessions ?? [];
  const totals = snap.analytics?.totals;
  const sys = snap.system;

  return (
    <div className="aegis-mission">
      <header className="aegis-mission-head">
        <div className="aegis-mission-tabs" role="tablist" aria-label="Mission Control views">
          {TABS.map(({ id, label, icon }) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id}
              className={`aegis-mission-tab ${tab === id ? "on" : ""}`} onClick={() => setTab(id)}>
              <Icon name={icon} /><span>{label}</span>
            </button>
          ))}
        </div>
        <div className="aegis-mission-status">
          <span className={`aegis-dot ${online ? "ok" : loaded ? "off" : ""}`} />
          <span>{online ? `${snap.model?.provider ?? "—"} · ${snap.model?.model ?? "—"}` : loaded ? "Backend offline" : "Connecting…"}</span>
        </div>
      </header>

      <div className="aegis-mission-body">
        {tab === "overview" && (
          <div className="aegis-mission-stage">
            <Orb active={orbActive} motion={motion} />
            <div className="aegis-readout">
              <strong>{orbActive ? "Working" : online ? "Standing by" : "Offline"}</strong>
              <small>{liveSessions} live session{liveSessions === 1 ? "" : "s"} · {board.running.length} running task{board.running.length === 1 ? "" : "s"}</small>
            </div>
            {loaded && !online && (
              <div className="aegis-offline"><Icon name="radar" /><p>Backend offline</p><span>Start Hermes to see live telemetry.</span></div>
            )}
            <div className="aegis-stage-tools">
              <button type="button" className="aegis-gear" aria-expanded={panelOpen} aria-label="Mission Control options" onClick={() => setPanelOpen(o => !o)}>
                <Icon name={panelOpen ? "x" : "sliders"} />
              </button>
              {panelOpen && (
                <div className="aegis-panel" role="group" aria-label="Mission Control options">
                  <p className="aegis-panel-title">Display</p>
                  <label className="aegis-toggle">
                    <input type="checkbox" checked={motionPref} disabled={reduceMotion}
                      onChange={e => { setMotionPref(e.target.checked); writePref(MOTION_KEY, e.target.checked ? "on" : "off"); }} />
                    <span>Orb motion{reduceMotion ? " (reduced motion is on)" : ""}</span>
                  </label>
                  <label className="aegis-toggle">
                    <input type="checkbox" checked={bootPref}
                      onChange={e => { setBootPref(e.target.checked); writePref(BOOT_PREF_KEY, e.target.checked ? "on" : "off"); }} />
                    <span>Boot screen on launch</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "agents" && (
          <div className="aegis-scroll">
            {!snap.profiles?.length && <p className="aegis-empty">{loaded ? "No profiles found." : "Loading…"}</p>}
            <div className="aegis-agent-grid">
              {(snap.profiles ?? []).map(p => {
                const busy = working.has(p.name) || p.gateway_running;
                return (
                  <article key={p.name} className="aegis-agent">
                    <div className="aegis-agent-head">
                      <span className={`aegis-state ${busy ? "working" : "idle"}`}>{working.has(p.name) ? "Working" : p.gateway_running ? "Online" : "Idle"}</span>
                      {p.is_default && <span className="aegis-chip">default</span>}
                    </div>
                    <strong className="aegis-agent-name">{p.display_name || p.name}</strong>
                    <p className="aegis-agent-desc">{p.description || "—"}</p>
                    <div className="aegis-agent-meta">
                      <span title="Model"><Icon name="cpu" />{p.model ? `${p.provider ? `${p.provider} · ` : ""}${p.model}` : "inherits"}</span>
                      <span>{p.skill_count} skills</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {tab === "tasks" && (
          <div className="aegis-scroll">
            {snap.board === null ? (
              <p className="aegis-empty">The kanban plugin isn't enabled. Enable it under Plugins to track agent tasks here.</p>
            ) : (
              <div className="aegis-kanban">
                {LANES.map(({ id, label }) => (
                  <section key={id} className="aegis-kanban-col">
                    <header className="aegis-kanban-head"><span className={`aegis-lane ${id}`} />{label}<em>{board[id].length}</em></header>
                    <div className="aegis-kanban-cards">
                      {board[id].length === 0 && <p className="aegis-empty small">Empty</p>}
                      {board[id].slice(0, 60).map(t => (
                        <article key={t.id} className={`aegis-task ${t.status === "blocked" || (t.consecutive_failures ?? 0) > 0 ? "failed" : ""}`}>
                          <p className="aegis-task-title">{t.title || "(untitled)"}</p>
                          <div className="aegis-task-meta">
                            <span>{t.assignee || "unassigned"}{t.status !== id ? ` · ${t.status}` : ""}</span>
                            <span>{ago(t.completed_at ?? t.started_at ?? t.created_at)}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "activity" && (
          <div className="aegis-scroll">
            {sessions.length === 0 && <p className="aegis-empty">{loaded ? "No sessions yet." : "Loading…"}</p>}
            <ul className="aegis-feed">
              {sessions.map(s => (
                <li key={s.id} className="aegis-feed-row">
                  <span className={`aegis-feed-kind ${s.is_active ? "live" : ""}`}>{s.is_active ? "live" : s.source || "session"}</span>
                  <span className="aegis-feed-label" title={s.title || s.id}>{s.title || s.id}</span>
                  <span className="aegis-feed-meta">{s.model || "—"} · {tokens(s.input_tokens + s.output_tokens)} tok · {s.tool_call_count} tools</span>
                  <time>{ago(s.last_active)}</time>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <footer className="aegis-strip">
        <Tile label="Model" value={snap.model?.model ?? "—"} title={snap.model?.provider} />
        <Tile label="Context" value={snap.model?.effective_context_length ? `${tokens(snap.model.effective_context_length)} tok` : "—"} />
        <Tile label="Tokens today" value={totals ? tokens(totals.total_input + totals.total_output) : "—"} />
        <Tile label="Cost today" value={money(totals ? (totals.total_actual_cost || totals.total_estimated_cost) : undefined)}
          title={totals && !totals.total_actual_cost ? "Estimated from token counts" : undefined} />
        <Tile label="CPU" value={sys?.cpu_percent !== undefined ? `${Math.round(sys.cpu_percent)}%` : "—"} title={sys?.cpu_count ? `${sys.cpu_count} cores` : undefined} />
        <Tile label="Memory" value={sys?.memory ? `${gb(sys.memory.used)}/${gb(sys.memory.total)} GB` : "—"} />
        <Tile label="Disk" value={sys?.disk ? `${Math.round(sys.disk.percent)}%` : "—"} title={sys?.disk ? `${gb(sys.disk.used)} of ${gb(sys.disk.total)} GB` : undefined} />
        <Tile label="Gateway" value={snap.status ? (snap.status.gateway_running ? "online" : "stopped") : "—"} />
      </footer>
    </div>
  );
}

function Tile({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="aegis-tile" title={title}>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
