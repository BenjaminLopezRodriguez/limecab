"use client";

import { useMemo, type ReactNode } from "react";
import {
  ArrowLeft01Icon,
  DeliveryTruck01Icon,
} from "@hugeicons/core-free-icons";

import { AdaptiveSurface } from "@/components/service-app/adaptive-surface";
import { LocationSearchScene } from "@/components/service-app/location-search-scene";
import { createMapboxAdapter } from "@/components/service-app/mapbox-adapter";
import { Icon } from "@/components/ui/icon";
import { EQUIPMENT_TYPES, type EquipmentType } from "@/lib/freight";
import { createPlacesAdapter } from "@/lib/limecab/places";
import type { MapPoint } from "@/lib/service-app/map-adapter";
import { formatMoney, type Location } from "@/lib/service-app/services";
import { env } from "@/env";
import { cn } from "@/lib/utils";

import {
  authBlocked,
  EQUIPMENT_LABEL,
  formatMiles,
  formatRatePerMile,
  loadLaneLabel,
  type FreightLoadCard,
} from "./freight-api";

export const placesAdapter = createPlacesAdapter();

export const mapAdapter = env.NEXT_PUBLIC_MAPBOX_TOKEN
  ? createMapboxAdapter(env.NEXT_PUBLIC_MAPBOX_TOKEN)
  : undefined;

/** Camera only until geolocation / a stop answers. */
export const FALLBACK_POINT: MapPoint = {
  latitude: 34.05,
  longitude: -118.25,
};

export { formatMoney };

export type LocField = "pickup" | "delivery" | "origin" | "dest";

export function EquipmentRow({
  value,
  onChange,
  allowAny,
  anySelected,
  onAny,
}: {
  value: EquipmentType;
  onChange: (e: EquipmentType) => void;
  allowAny?: boolean;
  anySelected?: boolean;
  onAny?: () => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {allowAny ? (
        <Chip selected={!!anySelected} onPress={() => onAny?.()}>
          Any
        </Chip>
      ) : null}
      {EQUIPMENT_TYPES.map((eq) => (
        <Chip
          key={eq}
          selected={!anySelected && value === eq}
          onPress={() => onChange(eq)}
        >
          {EQUIPMENT_LABEL[eq]}
        </Chip>
      ))}
    </div>
  );
}

export function Chip({
  selected,
  onPress,
  children,
}: {
  selected: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={cn(
        "rounded-full px-3.5 py-2 text-[13px] font-semibold tracking-tight transition-colors",
        selected
          ? "bg-foreground text-background"
          : "bg-secondary text-secondary-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function Empty({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "bg-secondary/60 text-muted-foreground rounded-3xl px-4 py-5 text-[14px] leading-relaxed",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function BackRow({
  label,
  onBack,
}: {
  label: string;
  onBack: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="text-muted-foreground flex items-center gap-1.5 text-[14px] font-medium"
    >
      <Icon icon={ArrowLeft01Icon} size={18} />
      {label}
    </button>
  );
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export function LocSearch({
  field,
  onClose,
  onSelect,
}: {
  field: LocField | null;
  onClose: () => void;
  onSelect: (loc: Location) => void;
}) {
  const title = useMemo(() => {
    if (field === "pickup" || field === "origin") return "Pickup / origin";
    if (field === "delivery" || field === "dest")
      return "Delivery / destination";
    return "Where?";
  }, [field]);

  return (
    <AdaptiveSurface.Interrupt
      id="freight-loc"
      presentation="fullscreen"
      label={title}
      open={field != null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <LocationSearchScene
        open={field != null}
        adapter={placesAdapter}
        title={title}
        onDismiss={onClose}
        onSelect={onSelect}
      />
    </AdaptiveSurface.Interrupt>
  );
}

export function ShipmentList({
  loads,
  loading,
  error,
  empty,
  onSelect,
  priceMode = "shipper",
}: {
  loads?: FreightLoadCard[];
  loading: boolean;
  error: { message: string } | null | undefined;
  empty: string;
  onSelect: (id: string) => void;
  priceMode?: "shipper" | "carrier";
}) {
  if (loading) {
    return <div className="bg-muted mt-3 h-24 animate-pulse rounded-3xl" />;
  }
  if (authBlocked(error)) {
    return (
      <p className="text-muted-foreground mt-3 text-[14px]">
        Sign in to operate freight.
      </p>
    );
  }
  if (error) {
    return (
      <p role="alert" className="text-destructive mt-3 text-[14px]">
        {error.message}
      </p>
    );
  }
  if (!loads?.length) {
    return <Empty className="mt-3">{empty}</Empty>;
  }
  return (
    <ul className="mt-3 space-y-2.5">
      {loads.map((load) => (
        <li key={load.id}>
          <button
            type="button"
            onClick={() => onSelect(load.id)}
            className="bg-card ring-border flex w-full items-center gap-3 rounded-2xl p-3.5 text-left ring-1"
          >
            <span className="bg-accent text-accent-foreground flex size-10 items-center justify-center rounded-full">
              <Icon icon={DeliveryTruck01Icon} size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium">
                {loadLaneLabel(load)}
              </span>
              <span className="text-muted-foreground text-[12px]">
                {load.status.replaceAll("_", " ")}
                {load.simulated ? " · Simulated" : ""}
              </span>
            </span>
            <span className="text-[14px] font-medium tabular-nums">
              {formatMoney(
                priceMode === "carrier"
                  ? load.carrierRateMinor
                  : load.shipperPriceMinor || load.carrierRateMinor,
                load.currency,
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function LoadResultCard({
  load,
  selected,
  onSelect,
}: {
  load: FreightLoadCard;
  selected?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "bg-card ring-border w-full rounded-3xl p-4 text-left ring-1 transition-shadow",
        selected && "ring-lime ring-2",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold tracking-tight">
            {loadLaneLabel(load)}
          </p>
          <p className="text-muted-foreground mt-1 text-[13px]">
            {EQUIPMENT_LABEL[load.equipmentType]} ·{" "}
            {load.totalWeight.toLocaleString()} lb ·{" "}
            {formatMiles(load.distanceMeters)}
            {load.deadheadMeters != null
              ? ` · ${formatMiles(load.deadheadMeters)} DH`
              : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[16px] font-semibold tabular-nums">
            {formatMoney(load.carrierRateMinor, load.currency)}
          </p>
          <p className="text-muted-foreground text-[12px] tabular-nums">
            {formatRatePerMile(load.carrierRateMinor, load.distanceMeters)}
            {load.simulated ? " · Sim" : ""}
          </p>
        </div>
      </div>
    </button>
  );
}

export function MinimalPane({
  title,
  body,
  onBack,
}: {
  title: string;
  body: string;
  onBack: () => void;
}) {
  return (
    <div className="pb-6 pt-2">
      <BackRow label="Back" onBack={onBack} />
      <h1 className="font-heading mt-4 text-2xl font-semibold tracking-[-0.03em]">
        {title}
      </h1>
      <Empty className="mt-6">{body}</Empty>
    </div>
  );
}
