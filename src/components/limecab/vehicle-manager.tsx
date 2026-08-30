"use client";

import { useEffect, useState } from "react";
import {
  Add01Icon,
  Car01Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons";

import {
  ProfileNote,
} from "@/components/limecab/profile";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

export type GarageVehicle = {
  id: string;
  make: string;
  model: string;
  color: string;
  plate: string;
};

type Draft = Omit<GarageVehicle, "id">;

const emptyDraft = (): Draft => ({
  make: "",
  model: "",
  color: "",
  plate: "",
});

function garageKey(driverId: string) {
  return `limecab.driver.garage.${driverId}`;
}

function sameVehicle(a: Draft, b: Draft) {
  return (
    a.make.trim().toLowerCase() === b.make.trim().toLowerCase() &&
    a.model.trim().toLowerCase() === b.model.trim().toLowerCase() &&
    a.color.trim().toLowerCase() === b.color.trim().toLowerCase() &&
    a.plate.trim().toLowerCase() === b.plate.trim().toLowerCase()
  );
}

function readGarage(driverId: string): GarageVehicle[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(garageKey(driverId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GarageVehicle[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v) => v && typeof v.id === "string" && typeof v.plate === "string",
    );
  } catch {
    return [];
  }
}

function writeGarage(driverId: string, vehicles: GarageVehicle[]) {
  window.localStorage.setItem(garageKey(driverId), JSON.stringify(vehicles));
}

/**
 * Vehicle manager / picker — Uber-shaped garage.
 *
 * The server holds one active vehicle (what riders match). Extra cars live
 * in a local garage so the driver can switch before going online. Selecting
 * stamps the chosen car onto the driver profile.
 */
export function VehicleManager({
  driverId,
  active,
}: {
  driverId: string;
  active: Draft;
}) {
  const utils = api.useUtils();
  const update = api.driver.updateVehicle.useMutation({
    onSuccess: () => void utils.driver.me.invalidate(),
  });

  const [garage, setGarage] = useState<GarageVehicle[]>([]);
  const [mode, setMode] = useState<"list" | "add" | "edit">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  useEffect(() => {
    const stored = readGarage(driverId);
    const hasActive = stored.some((v) => sameVehicle(v, active));
    const next = hasActive
      ? stored
      : [
          {
            id: `active-${driverId}`,
            ...active,
          },
          ...stored,
        ];
    setGarage(next);
    writeGarage(driverId, next);
  }, [driverId, active.make, active.model, active.color, active.plate]);

  const persist = (next: GarageVehicle[]) => {
    setGarage(next);
    writeGarage(driverId, next);
  };

  const select = (vehicle: GarageVehicle) => {
    if (sameVehicle(vehicle, active)) return;
    update.mutate({
      make: vehicle.make,
      model: vehicle.model,
      color: vehicle.color,
      plate: vehicle.plate,
    });
  };

  const openAdd = () => {
    setDraft(emptyDraft());
    setEditingId(null);
    setMode("add");
  };

  const openEdit = (vehicle: GarageVehicle) => {
    setDraft({
      make: vehicle.make,
      model: vehicle.model,
      color: vehicle.color,
      plate: vehicle.plate,
    });
    setEditingId(vehicle.id);
    setMode("edit");
  };

  const saveDraft = () => {
    const cleaned: Draft = {
      make: draft.make.trim(),
      model: draft.model.trim(),
      color: draft.color.trim(),
      plate: draft.plate.trim().toUpperCase(),
    };
    if (!cleaned.make || !cleaned.model || !cleaned.color || !cleaned.plate) {
      return;
    }

    if (mode === "edit" && editingId) {
      const prior = garage.find((v) => v.id === editingId);
      const next = garage.map((v) =>
        v.id === editingId ? { ...v, ...cleaned } : v,
      );
      persist(next);
      if (prior && sameVehicle(prior, active)) {
        update.mutate(cleaned);
      }
    } else {
      const id = crypto.randomUUID();
      persist([...garage, { id, ...cleaned }]);
      update.mutate(cleaned);
    }
    setMode("list");
    setEditingId(null);
    setDraft(emptyDraft());
  };

  const remove = (id: string) => {
    const target = garage.find((v) => v.id === id);
    if (!target) return;
    if (garage.length <= 1) return;
    if (sameVehicle(target, active)) return;
    persist(garage.filter((v) => v.id !== id));
  };

  if (mode === "add" || mode === "edit") {
    return (
      <VehicleForm
        title={mode === "add" ? "Add a vehicle" : "Edit vehicle"}
        draft={draft}
        busy={update.isPending}
        error={update.error?.message}
        onChange={setDraft}
        onCancel={() => {
          setMode("list");
          setEditingId(null);
        }}
        onSave={saveDraft}
      />
    );
  }

  return (
    <div>
      <p className="text-muted-foreground text-[15px] leading-relaxed">
        Pick the car you’re driving today. Riders match make, color, then
        plate at the curb.
      </p>

      <ul className="mt-6 space-y-3" role="listbox" aria-label="Your vehicles">
        {garage.map((vehicle) => {
          const selected = sameVehicle(vehicle, active);
          return (
            <li key={vehicle.id}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                disabled={update.isPending}
                onClick={() => select(vehicle)}
                className={cn(
                  "bg-card ring-border flex w-full items-center gap-3 rounded-2xl p-3 text-left ring-1 transition-colors",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  selected
                    ? "ring-lime/50 bg-lime/5"
                    : "active:bg-accent hover:bg-accent/40",
                )}
              >
                <span
                  aria-hidden
                  className="bg-muted flex size-14 shrink-0 items-center justify-center rounded-xl"
                >
                  <Icon
                    icon={Car01Icon}
                    size={24}
                    className="text-muted-foreground"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium tracking-tight">
                    {vehicle.make} {vehicle.model}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block truncate text-sm">
                    {vehicle.color}
                  </span>
                  <span className="mt-1 block text-sm font-medium tracking-tight tabular-nums">
                    {vehicle.plate}
                  </span>
                </span>
                {selected ? (
                  <Icon
                    icon={CheckmarkCircle02Icon}
                    size={22}
                    className="text-lime shrink-0"
                    aria-hidden
                  />
                ) : null}
              </button>
              <div className="mt-1.5 flex gap-3 px-1">
                <button
                  type="button"
                  className="text-muted-foreground text-[13px] font-semibold underline-offset-2 hover:underline"
                  onClick={() => openEdit(vehicle)}
                >
                  Edit
                </button>
                {!selected && garage.length > 1 ? (
                  <button
                    type="button"
                    className="text-muted-foreground text-[13px] font-semibold underline-offset-2 hover:underline"
                    onClick={() => remove(vehicle.id)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="mt-6 h-14 w-full gap-2 text-[16px]"
        onClick={openAdd}
      >
        <Icon icon={Add01Icon} size={20} />
        Add a vehicle
      </Button>

      {update.error ? (
        <p role="alert" className="text-destructive mt-4 text-[14px]">
          Couldn’t update vehicle. {update.error.message}
        </p>
      ) : null}

      <ProfileNote>
        {active.color} {active.make} {active.model} · {active.plate} is what
        riders see until you pick a different car here.
      </ProfileNote>
    </div>
  );
}

const FORM_FIELDS = [
  {
    name: "make" as const,
    label: "Make",
    placeholder: "Toyota",
    span: true,
  },
  {
    name: "model" as const,
    label: "Model",
    placeholder: "Prius",
    span: false,
  },
  {
    name: "color" as const,
    label: "Color",
    placeholder: "Silver",
    span: false,
  },
  {
    name: "plate" as const,
    label: "Plate",
    placeholder: "8ABC123",
    span: true,
  },
] as const;

function VehicleForm({
  title,
  draft,
  busy,
  error,
  onChange,
  onCancel,
  onSave,
}: {
  title: string;
  draft: Draft;
  busy: boolean;
  error?: string;
  onChange: (next: Draft) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <h2 className="font-heading text-[22px] font-semibold tracking-[-0.03em]">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-x-3 gap-y-5">
        {FORM_FIELDS.map((field) => (
          <label
            key={field.name}
            className={cn("block", field.span ? "col-span-2" : "col-span-1")}
          >
            <span className="mb-1.5 block text-[15px] font-medium tracking-tight">
              {field.label}
            </span>
            <Input
              required
              placeholder={field.placeholder}
              autoCapitalize={
                field.name === "plate" ? "characters" : "words"
              }
              spellCheck={false}
              value={draft[field.name]}
              onChange={(e) =>
                onChange({ ...draft, [field.name]: e.target.value })
              }
              className="h-14 text-[17px]"
            />
          </label>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-[14px]">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-3">
        <Button
          type="submit"
          size="lg"
          className="h-14 w-full text-[17px]"
          disabled={busy}
          aria-busy={busy || undefined}
        >
          {busy ? "Saving…" : "Save vehicle"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="h-14 w-full text-[17px]"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
