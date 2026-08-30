"use client";

import { useEffect, useRef, useState } from "react";

import { AdaptiveSurface } from "@/components/service-app/adaptive-surface";
import {
  ChoiceCopy,
  ChoiceList,
  ChoiceRow,
} from "@/components/service-app/choice-list";
import { PrimaryAction } from "@/components/service-app/task-scene";
import { Button } from "@/components/ui/button";
import { freight } from "@/components/freight/freight-api";
import type { FreightJob } from "@/components/limecab/driver-freight-scene";

/**
 * The two things a freight driver does that are not the ladder: report what
 * went wrong, and hand over the paperwork.
 *
 * Both are *interruptions*. They suspend the job sheet and give it back — the
 * map stays, the load stays, the primary action stays. A driver reporting a
 * closed gate has not stopped driving the load, so neither surface ejects them
 * from it, and neither moves the load to `EXCEPTION` behind their back.
 */

/* --------------------------------------------------------------- exception */

type ExceptionReason = { type: string; title: string };

/**
 * What can go wrong depends on where the truck is standing. A driver in
 * transit is not being told about lumper fees, and one at a gate is not being
 * asked about a breakdown. The list is the taxonomy dispatch actually uses.
 */
const PICKUP_REASONS: ExceptionReason[] = [
  { type: "FACILITY_CLOSED", title: "Facility closed" },
  { type: "CHECK_IN_BLOCKED", title: "Can't check in" },
  { type: "LOAD_NOT_READY", title: "Load not ready" },
  { type: "LOAD_REJECTED", title: "Load rejected" },
  { type: "WRONG_LOAD_INFO", title: "Wrong load information" },
  { type: "OTHER", title: "Other" },
];

const LOADING_REASONS: ExceptionReason[] = [
  { type: "DETENTION", title: "Detention" },
  { type: "WEIGHT_DISCREPANCY", title: "Weight discrepancy" },
  { type: "DAMAGED_FREIGHT", title: "Damaged freight" },
  { type: "LUMPER_PAYMENT", title: "Lumper/payment needed" },
  { type: "OTHER", title: "Other" },
];

const TRANSIT_REASONS: ExceptionReason[] = [
  { type: "BREAKDOWN", title: "Breakdown" },
  { type: "ACCIDENT", title: "Accident" },
  { type: "DELAY", title: "Delay" },
  { type: "ROUTE_ACCESS", title: "Route/access problem" },
  { type: "OTHER", title: "Other" },
];

const DELIVERY_REASONS: ExceptionReason[] = [
  { type: "RECEIVER_CLOSED", title: "Receiver closed" },
  { type: "RECEIVER_REJECTED", title: "Receiver rejected freight" },
  { type: "DETENTION", title: "Detention" },
  { type: "DAMAGE", title: "Damage" },
  { type: "OTHER", title: "Other" },
];

function reasonsForStatus(status: string): ExceptionReason[] {
  switch (status) {
    case "LOADING":
      return LOADING_REASONS;
    case "IN_TRANSIT":
      return TRANSIT_REASONS;
    case "AT_DELIVERY":
    case "UNLOADING":
    case "DELIVERED":
    case "POD_PENDING":
      return DELIVERY_REASONS;
    default:
      return PICKUP_REASONS;
  }
}

export function FreightExceptionSurface({
  load,
  open,
  onOpenChange,
  onReported,
}: {
  load: FreightJob;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReported: () => void;
}) {
  const [reason, setReason] = useState<ExceptionReason | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const report = freight.reportException.useMutation();

  // A reopened surface asks its question again, not the last one's answer.
  useEffect(() => {
    if (open) return;
    setReason(null);
    setNotes("");
    setError(null);
  }, [open]);

  const send = () => {
    if (!reason || report.isPending) return;
    setError(null);
    report.mutate(
      {
        loadId: load.id,
        type: reason.type,
        notes: notes.trim() || undefined,
        // Deliberately not `transitionLoad`. Reporting a problem is telling
        // dispatch, not abandoning the load: moving it to EXCEPTION here would
        // take the driver's next action away from them mid-lane.
      },
      {
        onSuccess: () => onReported(),
        onError: (cause) => setError(cause.message),
      },
    );
  };

  return (
    <AdaptiveSurface.Interrupt
      id="freight-exception"
      open={open}
      onOpenChange={onOpenChange}
      locked={report.isPending}
      label={reason ? reason.title : "Report an issue"}
      description={
        reason
          ? "Anything dispatch should know? Optional."
          : "Dispatch sees this straight away. You keep the load."
      }
    >
      {reason ? (
        <>
          <label htmlFor="freight-exception-notes" className="sr-only">
            Notes for dispatch
          </label>
          <textarea
            id="freight-exception-notes"
            rows={3}
            value={notes}
            maxLength={2000}
            placeholder="Guard says the yard is full until 09:00."
            onChange={(event) => setNotes(event.target.value)}
            className="bg-card ring-border placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-xl px-3 py-2.5 text-base leading-relaxed ring-1 focus-visible:ring-2 focus-visible:outline-none"
          />
          {error ? (
            <p role="alert" className="text-destructive mt-3 text-[15px]">
              {error}
            </p>
          ) : null}
          <PrimaryAction
            className="mt-4"
            onClick={send}
            aria-busy={report.isPending || undefined}
          >
            {report.isPending ? "Reporting…" : "Report"}
          </PrimaryAction>
          <Button
            variant="ghost"
            className="text-muted-foreground mt-1 h-11 w-full rounded-xl text-sm font-normal"
            disabled={report.isPending}
            onClick={() => setReason(null)}
          >
            Pick a different reason
          </Button>
        </>
      ) : (
        <ChoiceList>
          {reasonsForStatus(load.status).map((option) => (
            <ChoiceRow key={option.type} onClick={() => setReason(option)}>
              <ChoiceCopy title={option.title} />
            </ChoiceRow>
          ))}
        </ChoiceList>
      )}
    </AdaptiveSurface.Interrupt>
  );
}

/* --------------------------------------------------------------------- POD */

type PodStage = "empty" | "picked" | "uploading" | "unstored";

export function FreightPodSurface({
  load,
  open,
  onOpenChange,
  onSubmitted,
}: {
  load: FreightJob;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: (storageReference: string) => void;
}) {
  const [stage, setStage] = useState<PodStage>("empty");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const chosen = useRef<File | null>(null);

  useEffect(() => {
    if (open) return;
    setStage("empty");
    setError(null);
    chosen.current = null;
    setPreview((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
  }, [open]);

  // The object URL is a live handle on the picked file; leaking it holds the
  // whole photo in memory for the rest of the shift.
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pick = (file: File | null) => {
    if (!file) return;
    setError(null);
    chosen.current = file;
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
    setStage("picked");
  };

  const upload = async () => {
    const file = chosen.current;
    if (!file || stage === "uploading") return;
    setStage("uploading");
    setError(null);
    try {
      const body = new FormData();
      body.set("loadId", load.id);
      body.set("file", file);
      const response = await fetch("/api/freight/pod", {
        method: "POST",
        body,
      });
      const payload = (await response.json()) as {
        storageReference?: string | null;
        stored?: boolean;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Upload failed");
      }
      if (payload.stored && payload.storageReference) {
        onSubmitted(payload.storageReference);
        return;
      }
      // The server took the bytes nowhere. Never claim an upload that did not
      // happen — the driver decides whether to close the load without it.
      setStage("unstored");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed");
      setStage("picked");
    }
  };

  return (
    <AdaptiveSurface.Interrupt
      id="freight-pod"
      open={open}
      onOpenChange={onOpenChange}
      locked={stage === "uploading"}
      label="Proof of delivery"
      description="A photo of the signed bill closes this load out."
    >
      {/* ponytail: the camera is the platform's. `capture="environment"` opens
          the rear camera on a phone and a file picker everywhere else — no
          library, no permission dance, no preview pipeline to maintain. */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => pick(event.target.files?.[0] ?? null)}
      />

      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- a blob: URL from the driver's own camera, never optimizable
        <img
          src={preview}
          alt="The proof of delivery you just took"
          className="bg-muted mb-4 max-h-64 w-full rounded-2xl object-contain"
        />
      ) : null}

      {stage === "unstored" ? (
        <p className="text-muted-foreground mb-4 text-[15px] leading-snug">
          This build has nowhere to keep the photo, so it was not saved. You can
          still close the load out — keep the paper copy.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-destructive mb-3 text-[15px]">
          {error}
        </p>
      ) : null}

      {stage === "empty" ? (
        <PrimaryAction onClick={() => fileRef.current?.click()}>
          Add proof of delivery
        </PrimaryAction>
      ) : null}

      {stage === "picked" || stage === "uploading" ? (
        <>
          <PrimaryAction
            onClick={() => void upload()}
            aria-busy={stage === "uploading" || undefined}
          >
            {stage === "uploading" ? "Sending POD…" : "Submit POD"}
          </PrimaryAction>
          <Button
            variant="ghost"
            className="text-muted-foreground mt-1 h-11 w-full rounded-xl text-sm font-normal"
            disabled={stage === "uploading"}
            onClick={() => fileRef.current?.click()}
          >
            Retake
          </Button>
        </>
      ) : null}

      {stage === "unstored" ? (
        <PrimaryAction onClick={() => onSubmitted(`mock://pod/${load.id}`)}>
          Submit without the photo
        </PrimaryAction>
      ) : null}
    </AdaptiveSurface.Interrupt>
  );
}
