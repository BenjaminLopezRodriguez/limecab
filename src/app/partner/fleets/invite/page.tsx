"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Fleet invite stub — Uber Fleet Hub “Add Driver” shape:
 * operator enters name + phone; driver accepts in app later.
 * No persistence yet — records intent in UI only.
 */
export default function PartnerFleetsInvitePage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <main className="bg-background text-foreground mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-12 pt-[max(2rem,env(safe-area-inset-top))] md:px-8">
      <Link
        href="/partner/fleets"
        className="text-muted-foreground text-[14px] font-medium underline-offset-2 hover:underline"
      >
        ← Fleet hub
      </Link>

      <h1 className="font-heading mt-8 text-3xl font-semibold tracking-[-0.03em]">
        Invite a driver
      </h1>
      <p className="text-muted-foreground mt-3 text-[15px] leading-relaxed">
        They’ll get an invite to accept in Drive. Background checks and docs
        stay on the driver account before they go online.
      </p>

      {sent ? (
        <div className="bg-accent text-accent-foreground mt-8 rounded-3xl px-4 py-5 text-[15px] leading-relaxed">
          Invite staged for {name || "driver"} ({phone || "no phone"}). Wiring
          to push/SMS comes next — for now this is a product stub.
          <Link
            href="/partner/fleets"
            className="mt-4 block font-semibold underline-offset-2 hover:underline"
          >
            Back to fleet hub
          </Link>
        </div>
      ) : (
        <form
          className="mt-8 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          <label className="block">
            <span className="mb-1.5 block text-[15px] font-medium">Name</span>
            <Input
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-14 text-[17px]"
              placeholder="Alex Rivera"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[15px] font-medium">Phone</span>
            <Input
              required
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-14 text-[17px]"
              placeholder="+1 555 0100"
            />
          </label>
          <Button type="submit" size="lg" className="h-14 w-full text-[17px]">
            Send invite
          </Button>
        </form>
      )}
    </main>
  );
}
