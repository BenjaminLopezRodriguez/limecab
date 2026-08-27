"use client";

/** Sheet ↔ map contract: overlay insets as CSS vars, plus a resize ping. */

const EVENT = "limecab:overlay";

function overlayChanged() {
  window.dispatchEvent(new Event(EVENT));
}

export function onOverlayChange(fn: () => void) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

export function publishMapOverlay(node: HTMLElement | null): () => void {
  const shell = document.querySelector<HTMLElement>("[data-service-app-shell]");
  const clear = () => {
    if (!shell) return;
    shell.style.setProperty("--map-overlay-bottom", "0px");
    shell.style.setProperty("--map-overlay-end", "0px");
    overlayChanged();
  };
  if (!shell || !node) {
    clear();
    return clear;
  }

  const apply = () => {
    const box = node.getBoundingClientRect();
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    if (mobile) {
      const visible = Math.max(
        0,
        Math.min(box.height, window.innerHeight - box.top),
      );
      const capped = Math.min(visible, Math.round(window.innerHeight * 0.6));
      shell.style.setProperty(
        "--map-overlay-bottom",
        `${Math.round(capped)}px`,
      );
      shell.style.setProperty("--map-overlay-end", "0px");
    } else {
      shell.style.setProperty("--map-overlay-bottom", "0px");
      shell.style.setProperty("--map-overlay-end", `${Math.round(box.width)}px`);
    }
    overlayChanged();
  };

  apply();
  const observer = new ResizeObserver(apply);
  observer.observe(node);
  window.addEventListener("resize", apply);
  return () => {
    observer.disconnect();
    window.removeEventListener("resize", apply);
    clear();
  };
}

export function readMapPadding(): {
  top: number;
  bottom: number;
  left: number;
  right: number;
} {
  return {
    top: 72,
    left: 32,
    // The map container is already inset by the sheet; this is inner margin
    // so pins and the car sit in the middle of that remaining frame.
    bottom: 48,
    right: 32,
  };
}
