"use client";

import { useEffect, useState } from "react";

import { AdaptiveSurface } from "@/components/service-app/adaptive-surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { splitAddress, type Location } from "@/lib/service-app/services";
import { api } from "@/trpc/react";

/**
 * "Which place is this?" — one temporary question about an address the rider
 * is already looking at.
 *
 * An interruption, never a scene: saving a spot does not advance the booking,
 * so the quote, the search, or the pin underneath is suspended and restored,
 * not replaced. It is deliberately not a second control beside Confirm —
 * Confirm books, this files an address, and a scene answers one question.
 */
export function SavePlaceSurface({
  open,
  location,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** The address being filed. Null keeps the surface shut. */
  location: Location | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const save = api.places.set.useMutation();
  const utils = api.useUtils();
  const suggested = location ? splitAddress(location.address).line : "";
  const [label, setLabel] = useState(suggested);
  const [error, setError] = useState<string | null>(null);

  // A new address is a new question, so the field starts from that address.
  useEffect(() => {
    setLabel(suggested);
    setError(null);
  }, [suggested]);

  const commit = (kind: "home" | "work" | "custom") => {
    if (
      location?.latitude === undefined ||
      location.longitude === undefined ||
      save.isPending
    ) {
      return;
    }
    setError(null);
    save.mutate(
      {
        kind,
        label: kind === "custom" ? label.trim() || suggested : kind,
        address: location.address,
        latitude: location.latitude,
        longitude: location.longitude,
      },
      {
        onSuccess: () => {
          void utils.places.invalidate();
          onSaved?.();
          onClose();
        },
        onError: (cause) => setError(cause.message),
      },
    );
  };

  return (
    <AdaptiveSurface.Interrupt
      id="save-place"
      open={open && location !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      locked={save.isPending}
      label="Save this place"
      description={location?.address}
    >
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">
          {location ? splitAddress(location.address).line : ""}
        </p>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-12 flex-1"
            disabled={save.isPending}
            onClick={() => commit("home")}
          >
            Home
          </Button>
          <Button
            variant="outline"
            className="h-12 flex-1"
            disabled={save.isPending}
            onClick={() => commit("work")}
          >
            Work
          </Button>
        </div>

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            commit("custom");
          }}
        >
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={64}
            aria-label="Name this spot"
            placeholder="Name this spot"
            className="h-12 flex-1"
          />
          <Button
            type="submit"
            className="h-12"
            disabled={save.isPending || label.trim().length === 0}
          >
            Save
          </Button>
        </form>

        {error ? (
          <p role="alert" className="text-muted-foreground text-sm">
            {error}
          </p>
        ) : null}
      </div>
    </AdaptiveSurface.Interrupt>
  );
}
