"use client";

import { useState } from "react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

/**
 * Code → preview → accept. The preview step is not decoration: joining a
 * fleet hands a stranger's organization a role on this account, so what is
 * being accepted (carrier, role, and what the role can do) is shown before
 * the accept button exists. The grant lines come from the server's
 * `roleGrantLines`, which reads `capabilitiesForRole` — there is no second
 * copy of the permission table on the client.
 */
export function JoinFleetForm({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  // A link lands with the code already known — go straight to the preview.
  const [submitted, setSubmitted] = useState(initialCode);

  const preview = api.freight.previewFleetInvite.useQuery(
    { code: submitted },
    { enabled: submitted.trim().length > 0, retry: false },
  );
  const accept = api.freight.acceptFleetInvite.useMutation();

  if (accept.data) {
    const joined = accept.data;
    return (
      <div className="bg-card ring-border mt-8 rounded-3xl p-5 ring-1">
        <p className="text-lime font-heading text-[13px] font-semibold tracking-[0.08em] uppercase">
          Freight unlocked
        </p>
        <h2 className="font-heading mt-2 text-2xl font-semibold tracking-[-0.02em]">
          You&rsquo;re on {joined.carrierName}
        </h2>
        <p className="text-muted-foreground mt-2 text-[15px] leading-relaxed">
          Role: {joined.role}. Loads assigned to you now appear as jobs in
          Drive, alongside rides.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/driver"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-12 flex-1 text-[16px]",
            )}
          >
            Open Drive
          </Link>
          <Link
            href="/partner/fleets"
            className={cn(
              buttonVariants({ size: "lg", variant: "outline" }),
              "h-12 flex-1 text-[16px]",
            )}
          >
            Fleet hub
          </Link>
        </div>
      </div>
    );
  }

  const invite = preview.data;

  return (
    <>
      <form
        className="mt-8 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          accept.reset();
          setSubmitted(code.trim());
        }}
      >
        <label className="block">
          <span className="mb-1.5 block text-[15px] font-medium">
            Invite code
          </span>
          <Input
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="h-14 text-[17px] tracking-[0.08em] uppercase"
            placeholder="ABCD-EFGH"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <Button
          type="submit"
          size="lg"
          variant="outline"
          disabled={preview.isFetching}
          className="h-14 w-full text-[17px]"
        >
          {preview.isFetching ? "Checking…" : "Look up invite"}
        </Button>
      </form>

      {preview.error ? (
        <p role="alert" className="text-destructive mt-5 text-[15px]">
          {preview.error.message}
        </p>
      ) : null}

      {invite && !invite.ok ? (
        <p
          role="alert"
          className="bg-accent text-accent-foreground mt-5 rounded-3xl px-4 py-4 text-[15px] leading-relaxed"
        >
          {invite.message}
        </p>
      ) : null}

      {invite?.ok ? (
        <div className="bg-card ring-border mt-6 rounded-3xl p-5 ring-1">
          <p className="text-muted-foreground text-[13px] font-semibold tracking-[0.08em] uppercase">
            You&rsquo;re joining
          </p>
          <h2 className="font-heading mt-2 text-2xl font-semibold tracking-[-0.02em]">
            {invite.carrierName}
          </h2>
          <p className="text-muted-foreground mt-1 text-[15px]">
            as {invite.role}
            {invite.invitedName ? ` · invited as ${invite.invitedName}` : ""}
          </p>

          <p className="mt-5 text-[15px] font-medium">This role can:</p>
          <ul className="text-muted-foreground mt-2 space-y-1.5 text-[15px] leading-snug">
            {invite.grants.map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden className="text-lime">
                  •
                </span>
                {line}
              </li>
            ))}
          </ul>

          {accept.error ? (
            <p role="alert" className="text-destructive mt-4 text-[15px]">
              {accept.error.message}
            </p>
          ) : null}

          <Button
            type="button"
            size="lg"
            disabled={accept.isPending}
            className="mt-5 h-14 w-full text-[17px]"
            onClick={() => accept.mutate({ code: invite.code })}
          >
            {accept.isPending ? "Joining…" : `Accept and join ${invite.carrierName}`}
          </Button>
          <p className="text-muted-foreground mt-3 text-[13px]">
            This code works once, and only for your account.
          </p>
        </div>
      ) : null}
    </>
  );
}
