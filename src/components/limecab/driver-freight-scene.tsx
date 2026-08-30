"use client";

import { NavigateLink } from "@/components/limecab/driver-scenes";
import { SheetActions } from "@/components/service-app/service-sheet";
import { Button } from "@/components/ui/button";
import {
  EQUIPMENT_LABEL,
  formatMiles,
  freightLoadQuestion,
  loadLaneLabel,
  nextStop,
  type StopRow,
} from "@/components/freight/freight-api";
import {
  clockLabel,
  type ProximityBand,
  type ScheduleStanding,
} from "@/lib/limecab/freight-schedule";
import { formatMoney } from "@/lib/service-app/services";

/**
 * A freight load, running, on the driver's duty sheet.
 *
 * This is the same shape as `DriverJobScene` — one question, the next place
 * to be, one primary in the thumb zone — with freight's own ladder underneath
 * it. The load board is not here on purpose: finding and booking work is
 * dispatch, and it lives in the carrier portal. A driver on a mount is
 * answering "where next", not shopping.
 *
 * Nothing on this sheet is invented. The question and the CTA come from
 * `freightLoadQuestion`, which reads the server's legal-action list, so the
 * driver is never offered a step the load machine would refuse. `POD_PENDING`
 * and `EXCEPTION` have no legal driver action, so they get a status line and
 * no button rather than a dead primary.
 *
 * Schedule and proximity arrive as props, already computed by the duty shell.
 * Both are nullable and both mean "we do not know" when null: the appointment
 * renders alone rather than beside a guessed ETA.
 */

export type FreightJob = {
  id: string;
  status: string;
  /**
   * Absent for a driver whose role cannot see rate — the server omits it
   * (`redactLoadForRole`). The eyebrow drops the money rather than printing
   * a zero; an employee driver is not paid the load rate.
   */
  carrierRateMinor?: number;
  currency: string;
  distanceMeters: number;
  equipmentType: keyof typeof EQUIPMENT_LABEL;
  totalWeight: number;
  weightUnit?: string | null;
  simulated: boolean;
  stops?: StopRow[] | null;
};

/** The window the facility is expecting this truck in, never invented. */
function apptLabel(at: Date | string | null | undefined): string | null {
  if (!at) return null;
  const date = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Being on the property is a hint, not a fact — GPS is metres wrong next to a
 * warehouse wall, and only the driver knows if they are actually checked in.
 * So arrival only rewords the question while the truck is *travelling*; once
 * the ladder is inside a facility ("Are you loaded?") the status knows better
 * than the radius does.
 */
const TRAVELLING = new Set([
  "DRIVER_ASSIGNED",
  "EN_ROUTE_TO_PICKUP",
  "IN_TRANSIT",
]);

export function DriverFreightJobScene({
  load,
  busy,
  error,
  onAdvance,
  onReportIssue,
  onAddPod,
  standing = null,
  etaAt = null,
  proximity = null,
  distanceMeters = null,
}: {
  load: FreightJob;
  busy: boolean;
  error: string | null;
  onAdvance: () => void;
  onReportIssue?: () => void;
  onAddPod?: () => void;
  standing?: ScheduleStanding | null;
  etaAt?: Date | null;
  proximity?: ProximityBand | null;
  distanceMeters?: number | null;
}) {
  const { question, action, actionLabel } = freightLoadQuestion(load.status);
  const stop = nextStop({ stops: load.stops ?? [], status: load.status });
  const dropoff = stop?.type === "DROPOFF";
  const appointment = apptLabel(stop?.appointmentStart);
  const apptClock = clockLabel(stop?.appointmentStart);
  const etaClock = clockLabel(etaAt);

  const headline =
    proximity === "arrived" && TRAVELLING.has(load.status)
      ? dropoff
        ? "At the receiver?"
        : "At the pickup?"
      : question;

  return (
    <>
      <p className="text-lime text-xs font-semibold tracking-[0.14em] uppercase">
        Freight
        {load.carrierRateMinor == null
          ? ""
          : ` · ${formatMoney(load.carrierRateMinor)}`}
        {load.simulated ? " · Simulated" : ""}
      </p>
      <h2 className="mt-1 text-[26px] leading-tight font-semibold tracking-[-0.03em]">
        {headline}
      </h2>

      <div className="mt-3 flex items-start gap-3">
        <span
          className={
            dropoff
              ? "bg-foreground mt-1.5 size-3 shrink-0 rounded-[3px]"
              : "border-foreground mt-1.5 size-3 shrink-0 rounded-full border-[3px]"
          }
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[19px] leading-snug font-medium tracking-tight">
            {stop
              ? `${stop.city ?? stop.address}${stop.region ? `, ${stop.region}` : ""}`
              : "Next stop"}
          </p>
          {stop?.address ? (
            <p className="text-muted-foreground mt-0.5 text-[15px] leading-snug">
              {stop.address}
            </p>
          ) : null}

          {/* An appointment the truck is measured against, and only then the
              standing. No ETA without both halves — an invented minute is what
              gets a driver turned away at a gate. */}
          {standing && apptClock && etaClock ? (
            <>
              <p className="text-muted-foreground mt-0.5 text-[15px] tabular-nums">
                {dropoff ? "Delivery" : "Pickup"} · {apptClock}
              </p>
              <p
                className={`mt-0.5 text-[15px] tabular-nums ${
                  standing.late ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                ETA {etaClock} · {standing.label}
              </p>
            </>
          ) : appointment ? (
            <p className="text-muted-foreground mt-0.5 text-[15px] tabular-nums">
              Appointment {appointment}
            </p>
          ) : null}

          {proximity === "far" && distanceMeters != null ? (
            <p className="text-muted-foreground mt-0.5 text-[15px] tabular-nums">
              {formatMiles(distanceMeters)} away
            </p>
          ) : null}
        </div>
      </div>

      {/* Resolved: the lane and the trailer are a summary, not controls. */}
      <div className="bg-muted/60 mt-3 rounded-2xl px-4 py-3">
        <p className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
          The load
        </p>
        <p className="mt-0.5 text-[17px] leading-snug font-medium tracking-tight">
          {loadLaneLabel({ stops: load.stops ?? [] })}
        </p>
        <p className="text-muted-foreground text-[15px] tabular-nums">
          {EQUIPMENT_LABEL[load.equipmentType]} ·{" "}
          {load.totalWeight.toLocaleString()}{" "}
          {(load.weightUnit ?? "lb").toLowerCase()} ·{" "}
          {formatMiles(load.distanceMeters)}
        </p>
      </div>

      {/* Whatever the shipper wrote about this gate, verbatim, for this stop
          only. There is no facility product behind it — no hours, no parking
          count, no rating — so nothing here is generated. */}
      {stop?.instructions?.trim() ? (
        <div className="bg-muted/60 mt-3 rounded-2xl px-4 py-3">
          <p className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
            At this stop
          </p>
          <p className="mt-0.5 text-[15px] leading-snug whitespace-pre-line">
            {stop.instructions.trim()}
          </p>
        </div>
      ) : null}

      {stop?.address ? (
        <NavigateLink
          address={stop.address}
          latitude={stop.lat}
          longitude={stop.lng}
          className="mt-3"
        />
      ) : null}

      <SheetActions>
        {error ? (
          <p role="alert" className="text-destructive pb-1 text-[15px]">
            {error}
          </p>
        ) : null}
        {actionLabel ? (
          <Button
            size="lg"
            className="h-16 w-full text-[19px]"
            aria-busy={busy || undefined}
            disabled={busy}
            /* The proximity band never disables this. GPS prepares the scene;
               the driver confirms what actually happened. */
            onClick={action === "submit_pod" && onAddPod ? onAddPod : onAdvance}
          >
            {actionLabel}
          </Button>
        ) : (
          /* ponytail: no legal driver action here — the shipper or the
             settlement job moves this on. A button would be a lie. */
          <p className="text-muted-foreground py-2 text-[17px] leading-snug">
            {load.status === "EXCEPTION"
              ? "Dispatch has this one. Nothing to do from the cab."
              : "Waiting on the shipper to close this load out."}
          </p>
        )}
        {onReportIssue ? (
          <Button
            variant="ghost"
            className="text-muted-foreground mt-1 h-11 w-full rounded-xl text-[15px] font-normal"
            disabled={busy}
            onClick={onReportIssue}
          >
            Report an issue
          </Button>
        ) : null}
      </SheetActions>
    </>
  );
}

/**
 * The load is closed out. Leads with the outcome, not with controls: what was
 * delivered, how far it went, and that the paperwork landed.
 */
export function DriverFreightDeliveredScene({
  load,
  onDone,
}: {
  load: FreightJob;
  onDone: () => void;
}) {
  return (
    <>
      <p className="text-lime text-xs font-semibold tracking-[0.14em] uppercase">
        Delivered
      </p>
      <p className="mt-1 text-[26px] leading-tight font-semibold tracking-[-0.03em]">
        {loadLaneLabel({ stops: load.stops ?? [] })}
      </p>
      <p className="text-muted-foreground mt-2 text-[17px] tabular-nums">
        {formatMiles(load.distanceMeters)}
      </p>
      <p className="mt-3 text-[17px] font-medium tracking-tight">POD received</p>

      <SheetActions>
        <Button size="lg" className="h-16 w-full text-[19px]" onClick={onDone}>
          Done
        </Button>
      </SheetActions>
    </>
  );
}
