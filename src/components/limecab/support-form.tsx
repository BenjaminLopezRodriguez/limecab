"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import type { SupportTopic } from "@/lib/limecab/support";

export function SupportForm({
  tripId,
  topic,
}: {
  tripId: string;
  topic: SupportTopic;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const open = api.trip.openTicket.useMutation({
    onSuccess: () => {
      setDone(true);
      router.refresh();
    },
  });

  if (done) {
    return (
      <div className="ring-border rounded-2xl px-5 py-6 ring-1">
        <p className="text-[15px] font-semibold tracking-tight">
          We have your note
        </p>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          It is attached to this trip. Nothing is emailed in this build, but the
          ticket is stored on your account.
        </p>
        <Button
          className="mt-5"
          onClick={() => router.push(`/activity/${tripId}`)}
        >
          Back to trip
        </Button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        open.mutate({ tripId, topic, message });
      }}
    >
      <label className="block">
        <span className="text-[15px] font-medium tracking-tight">
          What happened
        </span>
        <textarea
          required
          minLength={8}
          maxLength={2000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={6}
          className="bg-muted focus-visible:ring-ring mt-2 w-full resize-y rounded-2xl px-4 py-3 text-[15px] leading-relaxed outline-none focus-visible:ring-2"
        />
      </label>
      {open.error ? (
        <p role="alert" className="text-destructive text-sm">
          {open.error.message}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={open.isPending || message.trim().length < 8}
        aria-busy={open.isPending || undefined}
      >
        {open.isPending ? "Sending…" : "Send"}
      </Button>
    </form>
  );
}
