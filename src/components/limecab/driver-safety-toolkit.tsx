"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccidentIcon,
  ArrowLeft01Icon,
  Call02Icon,
  Camera01Icon,
  Flag01Icon,
  Location01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

const REPORT_HREF =
  "mailto:safety@limecab.app?subject=Driver%20safety%20report";

/**
 * In-car safety actions. One interrupt, four things a driver can do without
 * leaving the map. Dashcam keeps rolling after this sheet closes.
 */
export function DriverSafetyToolkit({ dashcam }: { dashcam: Dashcam }) {
  const [panel, setPanel] = useState<"home" | "dashcam" | "accident">("home");

  if (panel === "dashcam") {
    return <DashcamPanel dashcam={dashcam} onBack={() => setPanel("home")} />;
  }

  if (panel === "accident") {
    return <AccidentPanel onBack={() => setPanel("home")} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="destructive"
        size="lg"
        className="h-16 w-full gap-2.5 text-[17px]"
        nativeButton={false}
        render={<a href="tel:911" />}
      >
        <Icon icon={Call02Icon} size={22} aria-hidden="true" />
        Call 911
      </Button>

      <div className="grid grid-cols-2 gap-2">
        <SafetyTile
          icon={Camera01Icon}
          label="Dashcam"
          hint={dashcam.recording ? "Recording" : "Record this trip"}
          pressed={dashcam.recording}
          onPress={() => setPanel("dashcam")}
        />
        <SafetyTile
          icon={AccidentIcon}
          label="Accident"
          hint="Get help now"
          onPress={() => setPanel("accident")}
        />
      </div>
      <SafetyTile
        icon={Flag01Icon}
        label="Report"
        hint="Email LimeCab safety"
        href={REPORT_HREF}
        wide
      />
    </div>
  );
}

export type Dashcam = {
  recording: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
};

/** Recording lives on the session, not the sheet, so closing Safety does not stop it. */
export function useDashcam(): Dashcam {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      recorderRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    },
    [],
  );

  const start = async () => {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("This phone can’t record from the browser.");
      return;
    }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      const mime = [
        "video/webm;codecs=vp9",
        "video/webm",
        "video/mp4",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "video/webm",
        });
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (blob.size === 0) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `limecab-dashcam-${Date.now()}.${blob.type.includes("mp4") ? "mp4" : "webm"}`;
        link.click();
        URL.revokeObjectURL(url);
      };
      recorder.start(1000);
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setError("Camera isn’t available. Check the permission and try again.");
    }
  };

  const stop = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  return { recording, error, start, stop };
}

function DashcamPanel({
  dashcam,
  onBack,
}: {
  dashcam: Dashcam;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <PanelBack onBack={onBack} label="Dashcam" />
      <p className="text-muted-foreground text-sm leading-relaxed">
        Records from this phone. The file stays on this device — nothing is
        uploaded.
      </p>
      {dashcam.recording ? (
        <p
          role="status"
          className="text-destructive text-[15px] font-semibold tracking-tight"
        >
          Recording
        </p>
      ) : null}
      {dashcam.error ? (
        <p role="alert" className="text-destructive text-sm leading-relaxed">
          {dashcam.error}
        </p>
      ) : null}
      {dashcam.recording ? (
        <Button size="lg" className="h-16 w-full text-[17px]" onClick={dashcam.stop}>
          Stop and save
        </Button>
      ) : (
        <Button
          size="lg"
          className="h-16 w-full text-[17px]"
          onClick={() => void dashcam.start()}
        >
          Start recording
        </Button>
      )}
    </div>
  );
}

function AccidentPanel({ onBack }: { onBack: () => void }) {
  const [shareNote, setShareNote] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <PanelBack onBack={onBack} label="Accident assist" />
      <p className="text-muted-foreground text-sm leading-relaxed">
        If anyone is hurt, call 911 first. Then stay if it’s safe.
      </p>
      <Button
        variant="destructive"
        size="lg"
        className="h-16 w-full gap-2.5 text-[17px]"
        nativeButton={false}
        render={<a href="tel:911" />}
      >
        <Icon icon={Call02Icon} size={22} aria-hidden="true" />
        Call 911
      </Button>
      <Button
        variant="outline"
        size="lg"
        className="h-14 w-full justify-start gap-3 text-[17px]"
        onClick={() => {
          void shareLocation().then(setShareNote, () =>
            setShareNote("Couldn’t share your location."),
          );
        }}
      >
        <Icon icon={Location01Icon} size={20} aria-hidden="true" />
        Share my location
      </Button>
      <Button
        variant="outline"
        size="lg"
        className="h-14 w-full justify-start gap-3 text-[17px]"
        nativeButton={false}
        render={<a href={REPORT_HREF} />}
      >
        <Icon icon={Flag01Icon} size={20} aria-hidden="true" />
        Report to LimeCab
      </Button>
      {shareNote ? (
        <p role="status" className="text-muted-foreground text-sm leading-relaxed">
          {shareNote}
        </p>
      ) : null}
    </div>
  );
}

function PanelBack({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="focus-visible:ring-ring -ml-1 flex min-h-11 items-center gap-1 self-start rounded-full px-1 text-[17px] font-semibold tracking-tight touch-manipulation focus-visible:ring-2 focus-visible:outline-none"
    >
      <Icon icon={ArrowLeft01Icon} size={20} aria-hidden="true" />
      {label}
    </button>
  );
}

function SafetyTile({
  icon,
  label,
  hint,
  href,
  pressed,
  onPress,
  wide,
}: {
  icon: IconSvgElement;
  label: string;
  hint: string;
  href?: string;
  pressed?: boolean;
  onPress?: () => void;
  wide?: boolean;
}) {
  const body: ReactNode = (
    <>
      <span className="bg-muted flex size-12 shrink-0 items-center justify-center rounded-full">
        <Icon icon={icon} size={22} aria-hidden="true" />
      </span>
      <span
        className={
          wide ? "flex min-w-0 flex-col items-start" : "flex min-w-0 flex-col items-center"
        }
      >
        <span className="text-[15px] font-semibold tracking-tight">{label}</span>
        <span className="text-muted-foreground truncate text-xs">{hint}</span>
      </span>
    </>
  );
  const className = wide
    ? "focus-visible:ring-ring hover:bg-muted active:bg-muted/80 flex min-h-16 flex-row items-center gap-3 rounded-2xl bg-muted/50 px-4 touch-manipulation focus-visible:ring-2 focus-visible:outline-none"
    : "focus-visible:ring-ring hover:bg-muted active:bg-muted/80 flex min-h-[6.25rem] flex-col items-center justify-center gap-2 rounded-2xl bg-muted/50 px-2 touch-manipulation focus-visible:ring-2 focus-visible:outline-none";

  if (href) {
    return (
      <a href={href} className={className}>
        {body}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={className}
      aria-pressed={pressed}
      onClick={onPress}
    >
      {body}
    </button>
  );
}

async function shareLocation(): Promise<string> {
  if (!navigator.geolocation) {
    throw new Error("Location isn’t available on this phone.");
  }
  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 15_000,
      timeout: 8_000,
    });
  });
  const { latitude, longitude } = position.coords;
  const text = `I'm here: https://maps.google.com/?q=${latitude},${longitude}`;
  if (navigator.share) {
    await navigator.share({ title: "My location", text });
    return "Location shared.";
  }
  await navigator.clipboard.writeText(text);
  return "Location copied.";
}
