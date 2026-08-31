import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { ScenarioDefinition, FlowSnapshot } from "./flow-machine.ts";
import { createScenario } from "./flow-machine.ts";
import { SceneRenderer } from "../web/SceneRenderer.tsx";
import { InterruptSurface } from "../web/InterruptSurface.tsx";
import type { PresentationEnvironment } from "../policy/environment.ts";
import type { SurfaceId } from "../core/surface.ts";
import { color, radius, typography } from "../tokens/index.ts";

/**
 * Development inspector. Deterministic: no timers, no randomness, no backend.
 * State lives in the machine, never inside an animation component — motion interpolates
 * between truth states, it never becomes the truth.
 */
export interface ScenarioPlayerProps<S extends string> {
  definition: ScenarioDefinition<S>;
  env: PresentationEnvironment;
  primary: SurfaceId;
  interrupts?: readonly { id: string; label: string }[];
  renderContent: (step: S) => ReactNode;
  renderActions?: (step: S) => ReactNode;
}

const btn = (active = false): React.CSSProperties => ({
  height: 32, padding: "0 12px", borderRadius: radius.pill, cursor: "pointer",
  border: `1px solid ${active ? color.lime.light : color.border.light}`,
  background: active ? color.accent.light : color.panel.light,
  fontSize: 12.5, fontWeight: 600, fontFamily: "inherit",
});

export function ScenarioPlayer<S extends string>({
  definition, env, primary, interrupts = [], renderContent, renderActions,
}: ScenarioPlayerProps<S>) {
  const [snap, setSnap] = useState<FlowSnapshot<S>>(() => createScenario(definition).snapshot());

  // Rebuilt from the snapshot every render — proves reconstructibility on every keystroke.
  const machine = useMemo(() => createScenario(definition, snap), [definition, snap]);
  const act = useCallback((fn: (m: ReturnType<typeof createScenario<S>>) => void) => {
    const m = createScenario(definition, snap);
    fn(m);
    setSnap(m.snapshot());
  }, [definition, snap]);

  const frame = machine.frame();
  const openInterrupt = interrupts.find((i) => i.id === snap.interrupt);

  return (
    <div style={{ display: "grid", gap: 16, justifyItems: "center", fontFamily: "system-ui" }}>
      <div style={{ position: "relative", borderRadius: 24, overflow: "hidden",
        border: `1px solid ${color.border.light}` }}>
        <SceneRenderer
          frame={frame} env={env} showOcclusion
          content={{ [primary]: renderContent(snap.step) }}
          actions={{ [primary]: snap.minimized ? null : renderActions?.(snap.step) }}
          dragIntent={{ [primary]: machine.isLive() && !snap.minimized ? "minimize" : "none" }}
          onDragIntent={() => act((m) => m.minimize())}
        />
        <InterruptSurface
          open={Boolean(openInterrupt)} env={env}
          label={openInterrupt?.label ?? "Exception"}
          onClose={() => act((m) => m.closeInterrupt())}
        >
          <div style={{ fontSize: typography.headline.size, fontWeight: 600, marginBottom: 4 }}>
            {openInterrupt?.label}
          </div>
          <div style={{ fontSize: typography.body.size, color: color.mutedForeground.light, marginBottom: 16 }}>
            The load underneath keeps running. Cancelling returns to the exact prior state.
          </div>
          <button style={{ ...btn(), width: "100%", height: 44 }}
            onClick={() => act((m) => m.closeInterrupt())}>
            Cancel exception
          </button>
        </InterruptSurface>
      </div>

      <div style={{ display: "grid", gap: 10, width: env.viewport.width, fontSize: 12.5 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <code style={{ color: color.lime.light, fontWeight: 600 }}>{snap.step.toUpperCase()}</code>
          {machine.isLive() ? <span style={{ color: color.mutedForeground.light }}>live</span> : null}
          {snap.minimized ? <span style={{ color: color.mutedForeground.light }}>· minimized</span> : null}
          {snap.interrupt ? <span style={{ color: color.mutedForeground.light }}>· interrupt open</span> : null}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={btn()} disabled={!machine.canRegress()} onClick={() => act((m) => m.previous())}>← Previous</button>
          <button style={btn()} disabled={!machine.canAdvance()} onClick={() => act((m) => m.next())}>Next →</button>
          <select
            value={snap.step} style={{ ...btn(), fontWeight: 400 }}
            onChange={(e) => act((m) => m.jump(e.target.value as S))}
          >
            {definition.order.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={btn(snap.minimized)} disabled={!machine.isLive()}
            onClick={() => act((m) => (snap.minimized ? m.restore() : m.minimize()))}>
            {snap.minimized ? "Restore" : "Minimize"}
          </button>
          {interrupts.map((i) => (
            <button key={i.id} style={btn(snap.interrupt === i.id)}
              onClick={() => act((m) => m.openInterrupt(i.id))}>
              {i.label}
            </button>
          ))}
        </div>

        <details>
          <summary style={{ cursor: "pointer", color: color.mutedForeground.light }}>
            snapshot — everything needed to rebuild this screen
          </summary>
          <pre style={{ fontSize: 11, background: color.muted.light, padding: 10,
            borderRadius: radius.chip, overflow: "auto" }}>{JSON.stringify(snap, null, 2)}</pre>
        </details>
      </div>
    </div>
  );
}
