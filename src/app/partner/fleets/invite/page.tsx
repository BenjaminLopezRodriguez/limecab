"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/trpc/react";

const ROLES = [
  {
    value: "DRIVER" as const,
    label: "Driver",
    blurb: "Runs loads on the road.",
  },
  {
    value: "DISPATCHER" as const,
    label: "Dispatcher",
    blurb: "Books loads and assigns drivers.",
  },
];

/**
 * Minting a fleet invite. This is where organizational identity is handed
 * out, so the server — not this form — decides who may do it: only a member
 * with `canManageFleet`. A failure here is shown verbatim rather than
 * flattened, because "you aren't a fleet manager" and "no membership at all"
 * are different problems for the person reading it.
 */
export default function PartnerFleetsInvitePage() {
  const [role, setRole] = useState<"DRIVER" | "DISPATCHER">("DRIVER");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);

  const createInvite = api.freight.createFleetInvite.useMutation();
  const invite = createInvite.data;

  const link =
    invite && typeof window !== "undefined"
      ? `${window.location.origin}/partner/fleets/join?code=${invite.code}`
      : "";

  return (
    <main className="bg-background text-foreground mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-12 pt-[max(2rem,env(safe-area-inset-top))] md:px-8">
      <Link
        href="/partner/fleets"
        className="text-muted-foreground text-[14px] font-medium underline-offset-2 hover:underline"
      >
        ← Fleet hub
      </Link>

      <h1 className="font-heading mt-8 text-3xl font-semibold tracking-[-0.03em]">
        Invite to your fleet
      </h1>
      <p className="text-muted-foreground mt-3 text-[15px] leading-relaxed">
        Create a code, then hand it over however you already talk to them. They
        enter it on Join a fleet — accepting is what unlocks freight in Drive.
      </p>

      {invite ? (
        <div className="bg-card ring-border mt-8 rounded-3xl p-5 ring-1">
          <p className="text-muted-foreground text-[13px] font-semibold tracking-[0.08em] uppercase">
            {invite.carrierName} · {invite.role}
          </p>
          <p className="font-heading mt-3 text-3xl font-semibold tracking-[0.06em] tabular-nums">
            {invite.code}
          </p>
          <p className="text-muted-foreground mt-2 text-[14px]">
            Single use. Expires{" "}
            {new Date(invite.expiresAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
            .
          </p>

          <p className="text-muted-foreground mt-5 text-[13px] break-all">
            {link}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              size="lg"
              className="h-12 flex-1 text-[16px]"
              onClick={() => {
                void navigator.clipboard?.writeText(link).then(() => {
                  setCopied(true);
                });
              }}
            >
              {copied ? "Link copied" : "Copy invite link"}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="h-12 flex-1 text-[16px]"
              onClick={() => {
                setCopied(false);
                createInvite.reset();
              }}
            >
              New invite
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="mt-8 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            createInvite.mutate({
              role,
              name: name.trim() || undefined,
              email: email.trim() || undefined,
            });
          }}
        >
          <fieldset>
            <legend className="mb-1.5 text-[15px] font-medium">Role</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  aria-pressed={role === r.value}
                  onClick={() => setRole(r.value)}
                  className={`rounded-2xl p-4 text-left ring-1 transition-colors ${
                    role === r.value
                      ? "bg-accent ring-lime"
                      : "bg-card ring-border hover:bg-accent/40"
                  }`}
                >
                  <span className="block text-[16px] font-semibold">
                    {r.label}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-[13px] leading-snug">
                    {r.blurb}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="mb-1.5 block text-[15px] font-medium">
              Name <span className="text-muted-foreground">(optional)</span>
            </span>
            <Input
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-14 text-[17px]"
              placeholder="Alex Rivera"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[15px] font-medium">
              Email <span className="text-muted-foreground">(optional)</span>
            </span>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-14 text-[17px]"
              placeholder="alex@example.com"
            />
          </label>

          {createInvite.error ? (
            <p role="alert" className="text-destructive text-[14px]">
              {createInvite.error.message}
            </p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            disabled={createInvite.isPending}
            className="h-14 w-full text-[17px]"
          >
            {createInvite.isPending ? "Creating…" : "Create invite code"}
          </Button>
        </form>
      )}
    </main>
  );
}
