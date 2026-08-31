import { useEffect, useRef, type ReactNode } from "react";
import type { PresentationEnvironment } from "../policy/environment.ts";
import { motionFor } from "../recipes/web/motion.ts";
import { color, radius, scrim } from "../tokens/index.ts";

/**
 * Derived from: src/components/service-app/adaptive-surface.tsx (AdaptiveSurface.Interrupt)
 *
 * Preserved: interrupts layer OVER the primary surface without unmounting it — the scene
 *            behind stays alive, which is what makes exact restore possible.
 *            `locked` suppresses dismissal, as production does during a committing task.
 *
 * Removed:   shadcn/Radix Dialog, the second snapshot stack (presentation + scrollTop +
 *            focus via rAF). Core restores the exact layout; scroll/focus are renderer
 *            concerns and the audit found none of them semantically load-bearing.
 *
 * Uses the platform <dialog>: focus trap, Escape, and inertness of the background come
 * from the browser rather than from hand-written trap logic.
 */
export interface InterruptSurfaceProps {
  open: boolean;
  env: PresentationEnvironment;
  locked?: boolean;
  label: string;
  onClose?: () => void;
  children?: ReactNode;
  /** Dark in-ride interrupt chrome (Uber-style). */
  variant?: "default" | "ride-dark";
}

export function InterruptSurface({
  open, env, locked = false, label, onClose, children, variant = "default",
}: InterruptSurfaceProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const motion = motionFor("interrupt", env.reducedMotion);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      e.preventDefault();          // Escape must not bypass a locked interrupt
      if (!locked) onClose?.();
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [locked, onClose]);

  const panelBg = variant === "ride-dark" ? "oklch(0.16 0.01 80)" : color.panel.light;

  return (
    <dialog
      ref={ref}
      aria-label={label}
      aria-busy={locked || undefined}
      style={{
        border: "none", padding: 0, margin: "auto auto 0", width: "100%",
        maxWidth: env.viewport.width, background: "transparent",
      }}
    >
      <div style={{
        background: panelBg,
        borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
        padding: `16px 20px ${20 + env.safeArea.bottom}px`,
        animation: `interrupt-in ${motion.duration}ms cubic-bezier(${motion.easing.join(",")})`,
      }}>
        {children}
      </div>
      <style>{`
        dialog::backdrop { background: rgba(0,0,0,${scrim.opacity}); }
        @keyframes interrupt-in { from { transform: translateY(12px); opacity: 0 } }
        @media (prefers-reduced-motion: reduce) { dialog > div { animation: none } }
      `}</style>
    </dialog>
  );
}
