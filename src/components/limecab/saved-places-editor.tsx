"use client";

import { useMemo, useState } from "react";

import { AdaptiveSurface } from "@/components/service-app/adaptive-surface";
import { LocationSearchScene } from "@/components/service-app/location-search-scene";
import { Button } from "@/components/ui/button";
import { SavePlaceSurface } from "@/components/limecab/limecab-save-place";
import { ProfileNote, ProfileSection } from "@/components/limecab/profile";
import { createPlacesAdapter } from "@/lib/limecab/places";
import { splitAddress, type Location } from "@/lib/service-app/services";
import { api } from "@/trpc/react";

/**
 * Saved places, as an editor.
 *
 * One question at a time. The row asks "which place is Home?"; answering it
 * opens the same prepared search environment the ride flow uses, and the
 * naming of a custom spot is an interruption over that search rather than a
 * third screen. Nothing here books anything.
 *
 * An account with no places shows two empty slots. That is the honest state —
 * not a demo rider's apartment.
 */
export function SavedPlacesEditor() {
  return (
    <AdaptiveSurface.Root>
      <Editor />
    </AdaptiveSurface.Root>
  );
}

/** Which slot the search is answering for. App data, not a screen flag. */
type Target = "home" | "work" | "custom";

function Editor() {
  const adapter = useMemo(() => createPlacesAdapter(), []);
  const utils = api.useUtils();
  const list = api.places.list.useQuery();
  const set = api.places.set.useMutation();
  const remove = api.places.remove.useMutation();

  const [target, setTarget] = useState<Target | null>(null);
  const [naming, setNaming] = useState<Location | null>(null);

  const refresh = () => void utils.places.invalidate();

  const choose = (result: Location) => {
    if (result.latitude === undefined || result.longitude === undefined) return;
    const kind = target;
    setTarget(null);
    if (kind === null) return;
    // A slot is named by what it is; a custom spot still needs its name, and
    // that is one more question, so it gets its own interruption.
    if (kind === "custom") {
      setNaming(result);
      return;
    }
    set.mutate(
      {
        kind,
        label: kind,
        address: result.address,
        latitude: result.latitude,
        longitude: result.longitude,
      },
      { onSettled: refresh },
    );
  };

  const clear = (id: string) => remove.mutate({ id }, { onSettled: refresh });

  const home = list.data?.home ?? null;
  const work = list.data?.work ?? null;
  const custom = list.data?.custom ?? [];
  const busy = set.isPending || remove.isPending;

  return (
    <>
      <ProfileSection>
        <SlotRow
          label="Home"
          address={home?.address ?? null}
          busy={busy}
          onSet={() => setTarget("home")}
          onClear={home ? () => clear("home") : undefined}
        />
        <SlotRow
          label="Work"
          address={work?.address ?? null}
          busy={busy}
          onSet={() => setTarget("work")}
          onClear={work ? () => clear("work") : undefined}
        />
      </ProfileSection>

      <ProfileSection title="Your spots">
        {custom.map((place) => (
          <SlotRow
            key={place.id}
            label={place.label}
            address={place.address}
            busy={busy}
            onClear={() => clear(place.id)}
          />
        ))}
        <div className="px-4 py-2">
          <Button
            variant="ghost"
            className="-ml-2 h-11 px-2"
            disabled={busy}
            onClick={() => setTarget("custom")}
          >
            Add a place
          </Button>
        </div>
      </ProfileSection>

      <ProfileNote>
        Home and Work fill in pickup and destination the moment you tap them on
        the map. Saying “take me home” uses the address you set here.
      </ProfileNote>

      <LocationSearchScene
        open={target !== null}
        adapter={adapter}
        title={
          target === "home"
            ? "Which place is Home?"
            : target === "work"
              ? "Which place is Work?"
              : "Which place is this?"
        }
        onSelect={choose}
        onDismiss={() => setTarget(null)}
      />

      <SavePlaceSurface
        open={naming !== null}
        location={naming}
        onClose={() => setNaming(null)}
        onSaved={refresh}
      />
    </>
  );
}

function SlotRow({
  label,
  address,
  busy,
  onSet,
  onClear,
}: {
  label: string;
  address: string | null;
  busy: boolean;
  onSet?: () => void;
  onClear?: () => void;
}) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4">
      <span className="shrink-0 text-[15px] font-medium tracking-tight">
        {label}
      </span>
      <span className="text-muted-foreground min-w-0 flex-1 truncate text-right text-sm">
        {address ? splitAddress(address).line : "Not set"}
      </span>
      {onSet ? (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          disabled={busy}
          onClick={onSet}
        >
          {address ? "Change" : "Set"}
        </Button>
      ) : null}
      {onClear ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground shrink-0"
          disabled={busy}
          onClick={onClear}
          aria-label={`Remove ${label}`}
        >
          Remove
        </Button>
      ) : null}
    </div>
  );
}
