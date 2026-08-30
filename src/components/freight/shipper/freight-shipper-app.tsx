"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Location01Icon } from "@hugeicons/core-free-icons";

import {
  AdaptiveSurface,
  useAdaptiveSurface,
} from "@/components/service-app/adaptive-surface";
import { LocationTrigger } from "@/components/service-app/location-trigger";
import { ServiceAppShell } from "@/components/service-app/service-app-shell";
import { ServiceMap } from "@/components/service-app/service-map";
import {
  ManagedSurface,
  SurfaceManagerProvider,
  useSurfaceManager,
} from "@/components/service-app/surface-manager";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { type EquipmentType } from "@/lib/freight";

import {
  asLoadCard,
  authBlocked,
  EQUIPMENT_LABEL,
  formatMiles,
  formatRatePerMile,
  freight,
  loadLaneLabel,
  placeFromLocation,
  quoteFromResult,
  stopPoint,
  toStopInput,
  type FreightPlace,
  type FreightQuote,
} from "@/components/freight/freight-api";
import {
  BackRow,
  Empty,
  EquipmentRow,
  FALLBACK_POINT,
  formatMoneyOrDash,
  LocSearch,
  mapAdapter,
  type LocField,
  Row,
  ShipmentList,
} from "@/components/freight/freight-parts";
import { QuoteScene } from "@/components/freight/shipper/freight-shipper-scenes";
import {
  shipperSurfaces,
  type ShipperSurfaceAction,
  type ShipperSurfaceId,
} from "@/components/freight/shipper/freight-shipper-surfaces";

/**
 * Lime Freight shipper product — compose a move, quote, publish.
 * Load detail lives at `/freight/shipments/[loadId]`.
 */
export function FreightShipperApp({ loadId }: { loadId?: string }) {
  return (
    <SurfaceManagerProvider manager={shipperSurfaces}>
      <AdaptiveSurface.Root>
        {loadId ? (
          <ShipperLoadDetail loadId={loadId} />
        ) : (
          <ShipperHome />
        )}
      </AdaptiveSurface.Root>
    </SurfaceManagerProvider>
  );
}

function ShipperHome() {
  const router = useRouter();
  const surfaces = useSurfaceManager<ShipperSurfaceId, ShipperSurfaceAction>();
  const surface = useAdaptiveSurface();
  const { perform } = surfaces;

  const [pickup, setPickup] = useState<FreightPlace | null>(null);
  const [delivery, setDelivery] = useState<FreightPlace | null>(null);
  const [equipment, setEquipment] = useState<EquipmentType>("DRY_VAN");
  const [weight, setWeight] = useState("42000");
  const [pickupDate, setPickupDate] = useState("");
  const [locField, setLocField] = useState<LocField | null>(null);
  const [quote, setQuote] = useState<FreightQuote | null>(null);
  const [draftLoadId, setDraftLoadId] = useState<string | undefined>();

  const shipments = freight.myShipments.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const getQuote = freight.getQuote.useMutation();
  const createDraft = freight.createDraft.useMutation();
  const publish = freight.publishShipment.useMutation();
  const bookShipment = freight.bookShipment.useMutation();

  const [failure, setFailure] = useState<string | null>(null);

  const mapCenter = pickup
    ? { latitude: pickup.latitude, longitude: pickup.longitude }
    : FALLBACK_POINT;

  /*
   * Which question the shipper is on *is* whether there is a quote. It used
   * to be read back out of `layout.primary.presentation`, which made the
   * scene a function of surface posture — the quote disappeared for any other
   * reason the rung changed. Posture says where the sheet sits, never what
   * the user has answered.
   */

  /**
   * Compose → quote is a progression: the draft and its price replace the
   * form, and there is nothing to come back to but a revision. The request
   * runs under the transition, so the surface moves on the tap and a refusal
   * puts the shipper back on their own inputs with the reason.
   */
  const requestQuote = () => {
    if (!pickup || !delivery || surface.progress.locked) return;
    const weightLb = Number(weight) || 0;
    const pickupAt = pickupDate
      ? new Date(`${pickupDate}T12:00:00`)
      : new Date();
    setFailure(null);
    void surface
      .transition({
        intent: "progress",
        from: "home",
        to: "quote",
        interim: "map",
        task: async () => {
          const draft = await createDraft.mutateAsync({
            pickup: toStopInput(pickup, pickupAt),
            delivery: toStopInput(delivery),
            equipmentType: equipment,
            weightLb,
          });
          const result = await getQuote.mutateAsync({ loadId: draft.id });
          setDraftLoadId(draft.id);
          setQuote(quoteFromResult(result));
        },
      })
      .then(
        () => perform("showQuote"),
        (reason: unknown) =>
          setFailure(
            reason instanceof Error && reason.message.trim()
              ? reason.message
              : "Couldn’t price that move. Nothing was published.",
          ),
      );
  };

  /**
   * Publish is the shipper's commitment: the load goes on the board. It is a
   * progression back to the compose surface, which is now a clean form.
   */
  const publishQuote = () => {
    const id = draftLoadId;
    if (!id || surface.progress.locked) return;
    setFailure(null);
    void surface
      .transition({
        intent: "progress",
        from: "quote",
        to: "home",
        interim: "map",
        task: async () => {
          // A draft that was already booked answers `publish` with a refusal;
          // booking it is the same commitment by the other door.
          await publish
            .mutateAsync({ loadId: id })
            .catch(() => bookShipment.mutateAsync({ loadId: id }));
          await shipments.refetch();
        },
      })
      .then(
        () => {
          setQuote(null);
          setDraftLoadId(undefined);
          perform("showHome");
        },
        (reason: unknown) =>
          setFailure(
            reason instanceof Error && reason.message.trim()
              ? reason.message
              : "Couldn’t publish that shipment.",
          ),
      );
  };

  const openLoc = (field: LocField) => {
    setLocField(field);
    perform("openLocSearch");
  };

  const closeLoc = () => {
    setLocField(null);
    perform("closeLocSearch");
  };

  return (
    <>
      <ServiceAppShell
        layout="home"
        map={
          <ManagedSurface<ShipperSurfaceId> id="map">
            <ServiceMap
              adapter={mapAdapter}
              center={mapCenter}
              mode={quote ? "route_preview" : "home"}
              className="h-full w-full"
            />
          </ManagedSurface>
        }
      >
        <ManagedSurface<ShipperSurfaceId> id="primary">
          {quote ? (
            <QuoteScene
              quote={quote}
              pickup={pickup}
              delivery={delivery}
              busy={surface.progress.locked}
              error={failure}
              onBack={() => {
                setFailure(null);
                setQuote(null);
                perform("showHome");
              }}
              onPublish={publishQuote}
            />
          ) : (
            <div className="pb-8 pt-2 md:pt-0">
              <h1 className="font-heading text-3xl font-semibold tracking-[-0.03em]">
                Move freight
              </h1>
              <p className="text-muted-foreground mt-1 text-[15px]">
                Pickup to delivery. Simulated rates labeled.
              </p>

              <div className="mt-5 space-y-2.5">
                <LocationTrigger
                  label={pickup?.address}
                  hint="Pickup facility"
                  onPress={() => openLoc("pickup")}
                  start={
                    <span className="bg-lime/20 text-lime-foreground ml-1 flex size-8 items-center justify-center rounded-full">
                      <Icon icon={Location01Icon} size={16} />
                    </span>
                  }
                />
                <LocationTrigger
                  label={delivery?.address}
                  hint="Delivery facility"
                  onPress={() => openLoc("delivery")}
                />
              </div>

              <EquipmentRow value={equipment} onChange={setEquipment} />

              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-muted-foreground mb-1.5 block text-[13px]">
                    Weight (lb)
                  </span>
                  <Input
                    inputMode="numeric"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="h-12"
                  />
                </label>
                <label className="block">
                  <span className="text-muted-foreground mb-1.5 block text-[13px]">
                    Pickup date
                  </span>
                  <Input
                    type="date"
                    value={pickupDate}
                    onChange={(e) => setPickupDate(e.target.value)}
                    className="h-12"
                  />
                </label>
              </div>

              <Button
                size="lg"
                className="mt-5 h-14 w-full text-[17px]"
                disabled={!pickup || !delivery || surface.progress.locked}
                aria-busy={surface.progress.locked || undefined}
                onClick={requestQuote}
              >
                {surface.progress.locked ? "Getting quote…" : "Get quote"}
              </Button>

              {failure &&
              !authBlocked(getQuote.error ?? createDraft.error) ? (
                <p role="alert" className="text-destructive mt-3 text-[14px]">
                  {failure}
                </p>
              ) : null}

              {/* Phone keeps a short list; desktop uses Shipments desk nav. */}
              <section className="mt-8 md:hidden">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-[17px] font-semibold tracking-tight">
                    Active shipments
                  </h2>
                  <button
                    type="button"
                    className="text-muted-foreground text-[13px] font-semibold underline-offset-2 hover:underline"
                    onClick={() => router.push("/freight/shipments")}
                  >
                    All
                  </button>
                </div>
                <ShipmentList
                  loads={shipments.data?.map(asLoadCard)}
                  loading={shipments.isLoading}
                  error={shipments.error}
                  empty="No active shipments. Publish a quote to get on the board."
                  onSelect={(id) => router.push(`/freight/shipments/${id}`)}
                />
              </section>
            </div>
          )}
        </ManagedSurface>
      </ServiceAppShell>

      <ManagedSurface<ShipperSurfaceId> id="interrupt">
        <LocSearch
          field={locField}
          onClose={closeLoc}
          onSelect={(loc) => {
            const place = placeFromLocation(loc);
            if (locField === "pickup") setPickup(place);
            if (locField === "delivery") setDelivery(place);
            closeLoc();
          }}
        />
      </ManagedSurface>
    </>
  );
}

function ShipperLoadDetail({ loadId }: { loadId: string }) {
  const router = useRouter();
  const loadQ = freight.getLoad.useQuery(
    { loadId },
    { refetchOnWindowFocus: false },
  );
  const load = loadQ.data;
  const center = stopPoint(load?.stops?.[0]) ?? FALLBACK_POINT;

  return (
    <div className="pb-6">
      <BackRow
        label="Shipments"
        onBack={() => router.push("/freight/shipments")}
      />

      {loadQ.isLoading ? (
        <div className="bg-muted mt-6 h-48 animate-pulse rounded-3xl" />
      ) : !load ? (
        <Empty className="mt-6">Load not found.</Empty>
      ) : (
        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:items-start">
          <div className="overflow-hidden rounded-3xl">
            <div className="h-44 lg:h-[min(28rem,calc(100dvh-12rem))]">
              <ServiceMap
                adapter={mapAdapter}
                center={center}
                mode="route_preview"
                className="h-full w-full"
              />
            </div>
          </div>

          <div className="lg:sticky lg:top-24">
            <h1 className="font-heading text-2xl font-semibold tracking-[-0.03em]">
              {loadLaneLabel(load)}
            </h1>
            <p className="text-muted-foreground mt-1 text-[14px]">
              {EQUIPMENT_LABEL[load.equipmentType]} ·{" "}
              {load.totalWeight.toLocaleString()} {load.weightUnit} ·{" "}
              {formatMiles(load.distanceMeters)}
            </p>

            <dl className="mt-5 space-y-2.5 text-[15px]">
              <Row
                label="Shipper price"
                value={formatMoneyOrDash(load.shipperPriceMinor, load.currency)}
              />
              <Row
                label="$/mi"
                value={formatRatePerMile(
                  load.carrierRateMinor,
                  load.distanceMeters,
                )}
              />
              <Row label="Status" value={load.status.replaceAll("_", " ")} />
              {load.simulated ? (
                <Row label="Pricing" value="Simulated" />
              ) : null}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
