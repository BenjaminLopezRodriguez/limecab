"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Car01Icon, Package01Icon } from "@hugeicons/core-free-icons";

import { Icon } from "@/components/ui/icon";
import { isCourierProduct } from "@/lib/limecab/courier";
import { isTerminalStatus, isTripStatus } from "@/server/limecab/state";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";

/**
 * The live ride, shrunk to a pill, for every screen that is not the ride.
 *
 * A ride in progress cannot simply be hidden while the rider reads their
 * Activity — they still need to know the car is coming. But the full sheet
 * owns the lower half of the screen, and it portals to the body, so hiding its
 * container does not hide it. This is the compromise both apps land on: the
 * ride collapses to something small, draggable, and always tappable back.
 *
 * Drag is a pointer-only affordance. Keyboard and screen-reader users get a
 * plain button that returns to the ride — no one has to drag anything to
 * reach it.
 */

const MARGIN = 12;
/** Past this much movement, the gesture is a drag and not a tap. */
const DRAG_SLOP = 6;

const RIDE_STATUS_LINE: Record<string, string> = {
  requested: "Finding your driver",
  matched: "Driver assigned",
  arriving: "Your driver is arriving",
  in_progress: "On the way",
};

const COURIER_STATUS_LINE: Record<string, string> = {
  requested: "Finding a courier",
  matched: "Courier assigned",
  arriving: "Your courier is arriving",
  in_progress: "Package on the way",
};

export function LimeCabTripPill({
  onRestore,
}: {
  /**
   * Minimized on the ride screen itself: the ride is still mounted, so the pill
   * restores its sheet in place. Off Home there is nothing to restore to, and
   * the pill navigates instead.
   */
  onRestore?: () => void;
} = {}) {
  const router = useRouter();
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
  } | null>(null);

  const trip = api.trip.active.useQuery(undefined, {
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || !isTripStatus(status)) return 8_000;
      return isTerminalStatus(status) ? false : 4_000;
    },
  });

  /** Keep the pill on screen when the viewport changes under it. */
  const clamp = useCallback((next: { x: number; y: number }) => {
    const el = ref.current;
    const w = el?.offsetWidth ?? 200;
    const h = el?.offsetHeight ?? 56;
    return {
      x: Math.min(Math.max(MARGIN, next.x), window.innerWidth - w - MARGIN),
      y: Math.min(Math.max(MARGIN, next.y), window.innerHeight - h - MARGIN),
    };
  }, []);

  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clamp(p) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp]);

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    const el = ref.current;
    if (!el || event.button !== 0) return;
    const box = el.getBoundingClientRect();
    drag.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - box.left,
      offsetY: event.clientY - box.top,
      moved: false,
    };
    el.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    if (state?.pointerId !== event.pointerId) return;
    const next = clamp({
      x: event.clientX - state.offsetX,
      y: event.clientY - state.offsetY,
    });
    const el = ref.current;
    if (!state.moved && el) {
      const box = el.getBoundingClientRect();
      if (Math.hypot(next.x - box.left, next.y - box.top) > DRAG_SLOP) {
        state.moved = true;
      }
    }
    if (state.moved) setPos(next);
  };

  const endDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    if (state?.pointerId !== event.pointerId) return;
    drag.current = null;
    ref.current?.releasePointerCapture(event.pointerId);
    // A drag that ends is not also a tap.
    if (state.moved) event.preventDefault();
  };

  const ride = trip.data;
  if (!ride || !isTripStatus(ride.status) || isTerminalStatus(ride.status)) {
    return null;
  }

  const courier = isCourierProduct(ride.productId);
  const lines = courier ? COURIER_STATUS_LINE : RIDE_STATUS_LINE;
  const line = lines[ride.status] ?? (courier ? "Delivery in progress" : "Ride in progress");
  const detail = ride.driver
    ? `${ride.driver.vehicleColor} ${ride.driver.vehicleMake} · ${ride.driver.vehiclePlate}`
    : `Arriving in ~${ride.arrivalMinutes} min`;

  return (
    <button
      ref={ref}
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClick={() => {
        if (drag.current?.moved) return;
        if (onRestore) {
          onRestore();
          return;
        }
        router.push("/");
      }}
      style={
        pos
          ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
          : undefined
      }
      className={cn(
        "bg-card/90 ring-border focus-visible:ring-ring fixed z-40 flex touch-none items-center gap-3 rounded-full py-2.5 pr-4 pl-2.5 shadow-lg ring-1 backdrop-blur-xl select-none focus-visible:ring-2",
        // Default berth: above the floating tab capsule, out of the thumb path.
        !pos && "right-4 bottom-28",
      )}
      aria-label={`${line}. ${detail}. Back to your ${courier ? "delivery" : "ride"}.`}
    >
      <span
        aria-hidden="true"
        className="bg-lime text-lime-foreground relative flex size-9 shrink-0 items-center justify-center rounded-full"
      >
        <Icon icon={courier ? Package01Icon : Car01Icon} size={18} />
        <span className="bg-lime absolute inset-0 animate-ping rounded-full opacity-40 motion-reduce:hidden" />
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-[13px] leading-tight font-semibold tracking-tight">
          {line}
        </span>
        <span className="text-muted-foreground block truncate text-[12px] leading-tight tabular-nums">
          {detail}
        </span>
      </span>
    </button>
  );
}
