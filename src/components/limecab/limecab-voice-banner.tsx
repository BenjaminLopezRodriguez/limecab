"use client";

import { Mic01Icon } from "@hugeicons/core-free-icons";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { parseRideUtterance } from "@/lib/limecab/voice-booking";
import { cn } from "@/lib/utils";

type SpeechResult = ArrayLike<{ transcript: string }> & { isFinal?: boolean };

type SpeechCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<SpeechResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function speechCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & {
    SpeechRecognition?: SpeechCtor;
    webkitSpeechRecognition?: SpeechCtor;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

export function VoiceMicButton({
  onPress,
  listening,
}: {
  onPress: () => void;
  listening?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={listening ? "Listening" : "Book by voice"}
      aria-pressed={listening}
      className={cn(
        "text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-full",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        listening && "bg-lime text-lime-foreground",
      )}
    >
      <Icon icon={Mic01Icon} size={20} />
    </button>
  );
}

/**
 * Listening / typed fallback. Lives inside the search scene so Home and
 * recents stay mounted behind it. Never requests a trip.
 */
export function LimeCabVoiceBanner({
  capture,
  error,
  onTypedChange,
  onSubmit,
  onCancel,
}: {
  capture: { kind: "listening"; transcript: string } | { kind: "typed"; draft: string };
  error?: string | null;
  onTypedChange: (text: string) => void;
  onSubmit: (text: string) => void;
  onCancel: () => void;
}) {
  if (capture.kind === "listening") {
    return (
      <div className="bg-muted/60 mb-3 rounded-2xl px-4 py-3">
        <p className="text-[15px] font-medium tracking-tight">Listening…</p>
        <p className="text-muted-foreground mt-1 min-h-5 text-sm">
          {capture.transcript || "Say a place and how you’d like to ride."}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground mt-2 text-sm underline-offset-2 hover:underline"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="mb-3">
      <label htmlFor="voice-fallback" className="text-[15px] font-medium tracking-tight">
        Type what you’d say
      </label>
      <p className="text-muted-foreground mt-0.5 text-sm leading-snug">
        Voice isn’t available here. Same parser, still lands on Confirm.
      </p>
      <textarea
        id="voice-fallback"
        rows={3}
        value={capture.draft}
        onChange={(event) => onTypedChange(event.target.value)}
        placeholder="Take me to LAX in an XL"
        className="bg-card ring-border placeholder:text-muted-foreground focus-visible:ring-ring mt-2 w-full resize-none rounded-xl px-3 py-2.5 text-base leading-relaxed ring-1 focus-visible:ring-2 focus-visible:outline-none"
      />
      {error ? (
        <p role="alert" className="text-muted-foreground mt-2 text-sm">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          className="flex-1"
          onClick={() => onSubmit(capture.draft)}
        >
          Find this ride
        </Button>
        <Button type="button" variant="ghost" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function useVoiceCapture(onHeard: (text: string) => void) {
  const [capture, setCapture] = useState<
    { kind: "idle" } | { kind: "listening"; transcript: string } | { kind: "typed"; draft: string }
  >({ kind: "idle" });
  const lock = useRef(false);
  const rec = useRef<InstanceType<SpeechCtor> | null>(null);
  const hangTimer = useRef(0);
  const heard = useRef(onHeard);
  heard.current = onHeard;

  const stop = () => {
    window.clearTimeout(hangTimer.current);
    rec.current?.abort();
    rec.current = null;
    lock.current = false;
    setCapture({ kind: "idle" });
  };

  useEffect(() => () => stop(), []);

  const start = () => {
    if (lock.current) return;
    const Ctor = speechCtor();
    if (!Ctor) {
      setCapture({ kind: "typed", draft: "" });
      return;
    }
    lock.current = true;
    const session = new Ctor();
    session.continuous = false;
    session.interimResults = true;
    session.lang = "en-US";
    session.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const transcript = last?.[0]?.transcript?.trim() ?? "";
      setCapture({ kind: "listening", transcript });
      if (transcript && last?.isFinal) {
        lock.current = false;
        rec.current = null;
        heard.current(transcript);
      }
    };
    session.onerror = (event) => {
      lock.current = false;
      rec.current = null;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setCapture({ kind: "typed", draft: "" });
        return;
      }
      setCapture({ kind: "typed", draft: "" });
    };
    session.onend = () => {
      lock.current = false;
      rec.current = null;
      setCapture((current) => {
        if (current.kind === "listening" && current.transcript) {
          heard.current(current.transcript);
          return current;
        }
        if (current.kind === "listening") {
          return { kind: "typed", draft: "" };
        }
        return current;
      });
    };
    rec.current = session;
    setCapture({ kind: "listening", transcript: "" });
    try {
      session.start();
    } catch {
      lock.current = false;
      rec.current = null;
      setCapture({ kind: "typed", draft: "" });
      return;
    }
    window.clearTimeout(hangTimer.current);
    hangTimer.current = window.setTimeout(() => {
      if (!lock.current) return;
      rec.current?.abort();
      rec.current = null;
      lock.current = false;
      setCapture((current) =>
        current.kind === "listening" && !current.transcript
          ? { kind: "typed", draft: "" }
          : current,
      );
    }, 4000);
  };

  return { capture, start, stop, setTyped: (draft: string) => setCapture({ kind: "typed", draft }) };
}

export function submitVoiceText(
  text: string,
  onFail: (message: string) => void,
): ReturnType<typeof parseRideUtterance> | null {
  const parsed = parseRideUtterance(text);
  if (!parsed.destinationQuery) {
    onFail("Couldn’t find that place. Try a fixture like LAX, Home, or Griffith.");
    return null;
  }
  return parsed;
}
