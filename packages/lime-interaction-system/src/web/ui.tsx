/**
 * Layer: web renderer.
 *
 * The atoms moved to `@lime/ui` — they pass the portability test, so they are kit rather than
 * lab. They are re-exported here so existing lab imports keep resolving, and `LimeInput` stays
 * as an alias for the shorter public name.
 *
 * What remains is the two frames that are still web-only chrome: they exist to give a story a
 * dialog or a drawer to sit in, and neither has a native counterpart worth shipping in the kit.
 */
import type { ReactNode } from "react";
import { color, radius, spacing, typography } from "../tokens/index.ts";
import { t } from "./styles.ts";

export {
  Button,
  Input,
  Input as LimeInput,
  ProgressBar,
  Separator,
  IconGlyph,
  MapFloatingButton,
} from "@lime/ui";
export type { ButtonProps, ButtonSize, ButtonVariant, InputProps } from "@lime/ui";

export function DialogFrame({ title, description, children, onClose }: {
  title: string; description?: string; children: ReactNode; onClose?: () => void;
}) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby={description ? "dlg-desc" : undefined}
      style={{ width: 360, maxWidth: "90vw", background: color.panel.light, borderRadius: radius.sheet,
        border: `1px solid ${color.border.light}`, padding: spacing.xl, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: spacing.md }}>
        <div>
          <div id="dlg-title" style={t(typography.headline)}>{title}</div>
          {description ? <div id="dlg-desc" style={{ ...t(typography.body), marginTop: 4,
            color: color.mutedForeground.light }}>{description}</div> : null}
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ border: "none", background: "transparent", fontSize: 20, cursor: "pointer" }}>×</button>
        ) : null}
      </div>
      <div style={{ marginTop: spacing.lg }}>{children}</div>
    </div>
  );
}

export function DrawerFrame({ title, children, snapLabel }: {
  title?: string; children: ReactNode; snapLabel?: string;
}) {
  return (
    <div style={{ width: 390, background: color.panel.light, borderRadius: `${radius.sheet}px ${radius.sheet}px 0 0`,
      border: `1px solid ${color.border.light}`, borderBottom: "none", padding: spacing.xl,
      fontFamily: "system-ui" }}>
      <div aria-hidden style={{ width: 36, height: 4, borderRadius: radius.pill,
        background: color.border.light, margin: "0 auto", marginBottom: spacing.md }} />
      {title ? <div style={{ ...t(typography.subhead), marginBottom: spacing.md }}>{title}</div> : null}
      {snapLabel ? <div style={{ ...t(typography.metadata), color: color.mutedForeground.light,
        marginBottom: spacing.sm }}>{snapLabel}</div> : null}
      {children}
    </div>
  );
}
