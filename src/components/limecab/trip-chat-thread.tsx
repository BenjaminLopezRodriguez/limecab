"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp01Icon } from "@hugeicons/core-free-icons";

import { AdaptiveSurface } from "@/components/service-app/adaptive-surface";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";

const POLL_MS = 2_000;

function stamp(value: Date) {
  return value.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * The in-trip thread. Same component on rider and driver — the server
 * decides which side "me" is, and both poll the same rows.
 */
export function TripChatThread({
  tripId,
  fallbackName,
}: {
  tripId: string;
  fallbackName: string;
}) {
  const [draft, setDraft] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const thread = api.tripChat.list.useQuery(
    { tripId },
    { refetchInterval: POLL_MS },
  );
  const utils = api.useUtils();
  const send = api.tripChat.send.useMutation({
    onSuccess: async () => {
      setDraft("");
      await utils.tripChat.list.invalidate({ tripId });
    },
  });

  const messages = thread.data?.messages ?? [];
  const me = thread.data?.me;
  const canSend = thread.data?.canSend ?? false;
  const name = thread.data?.counterpartName ?? fallbackName;

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const submit = () => {
    const body = draft.trim();
    if (!body || send.isPending || !canSend) return;
    send.mutate({ tripId, body });
  };

  const empty = !thread.isLoading && messages.length === 0;
  const failed = send.isError;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
        {thread.isLoading ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            Loading messages…
          </p>
        ) : null}
        {thread.isError ? (
          <p role="alert" className="text-destructive text-sm leading-relaxed">
            Couldn’t load this chat. Try again in a moment.
          </p>
        ) : null}
        {empty ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            Say hello to {name}. They’ll see it here.
          </p>
        ) : null}
        <ol className="flex flex-col gap-3">
          {messages.map((message) => {
            const mine = message.senderRole === me;
            return (
              <li
                key={message.id}
                className={cn("flex flex-col", mine ? "items-end" : "items-start")}
              >
                <p
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug",
                    mine
                      ? "bg-lime text-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  {message.body}
                </p>
                <time
                  dateTime={message.createdAt.toISOString()}
                  className="text-muted-foreground mt-1 px-1 text-[11px] tabular-nums"
                >
                  {stamp(message.createdAt)}
                </time>
              </li>
            );
          })}
        </ol>
        <div ref={bottom} />
      </div>

      <form
        className="border-border flex items-end gap-2 border-t px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={canSend ? `Message ${name}` : "Chat is closed"}
          maxLength={500}
          disabled={!canSend || send.isPending}
          aria-label={`Message ${name}`}
          autoComplete="off"
          enterKeyHint="send"
        />
        <Button
          type="submit"
          size="icon-lg"
          className="size-12 shrink-0 rounded-full"
          disabled={!canSend || send.isPending || draft.trim().length === 0}
          aria-label={send.isPending ? "Sending" : "Send"}
          aria-busy={send.isPending || undefined}
        >
          <Icon icon={ArrowUp01Icon} size={20} aria-hidden="true" />
        </Button>
      </form>
      {failed ? (
        <p role="alert" className="text-destructive px-5 pb-3 text-sm">
          {send.error.message || "Message didn’t send. Try again."}
        </p>
      ) : null}
    </div>
  );
}

export function LimeCabTripChatSurface({
  open,
  tripId,
  counterpartName,
  onClose,
}: {
  open: boolean;
  tripId: string | null;
  counterpartName: string;
  onClose: () => void;
}) {
  return (
    <AdaptiveSurface.Interrupt
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      id="trip-chat"
      presentation="overlay"
      label={`Message ${counterpartName}`}
    >
      {open && tripId ? (
        <TripChatThread tripId={tripId} fallbackName={counterpartName} />
      ) : (
        <p className="text-muted-foreground px-5 text-sm leading-relaxed">
          Chat opens once a driver is assigned.
        </p>
      )}
    </AdaptiveSurface.Interrupt>
  );
}
