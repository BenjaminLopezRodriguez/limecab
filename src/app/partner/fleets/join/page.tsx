"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Join-a-fleet stub — Uber “accept fleet invite” shape.
 * Real path later: inbox invite → accept → freightJobs unlocked on /driver.
 */
export default function PartnerFleetsJoinPage() {
  const [code, setCode] = useState("");
  const [joined, setJoined] = useState(false);

  return (
    <main className="bg-background text-foreground mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-12 pt-[max(2rem,env(safe-area-inset-top))] md:px-8">
      <Link
        href="/partner/fleets"
        className="text-muted-foreground text-[14px] font-medium underline-offset-2 hover:underline"
      >
        ← Fleet hub
      </Link>

      <h1 className="font-heading mt-8 text-3xl font-semibold tracking-[-0.03em]">
        Join a fleet
      </h1>
      <p className="text-muted-foreground mt-3 text-[15px] leading-relaxed">
        Enter the invite code from your fleet operator. After you join,
        freight loads can appear in Drive (once the inbox gate is wired).
      </p>

      {joined ? (
        <div className="bg-accent text-accent-foreground mt-8 rounded-3xl px-4 py-5 text-[15px] leading-relaxed">
          Invite accepted (stub). Open Drive and finish any docs. Freight
          preference unlocks when membership is stored on your account.
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/driver"
              className="font-semibold underline-offset-2 hover:underline"
            >
              Open Drive
            </Link>
            <Link
              href="/driver/profile/preferences"
              className="font-semibold underline-offset-2 hover:underline"
            >
              Driver preferences
            </Link>
          </div>
        </div>
      ) : (
        <form
          className="mt-8 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            setJoined(true);
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
              className="h-14 text-[17px]"
              placeholder="FLEET-XXXX"
              autoCapitalize="characters"
              spellCheck={false}
            />
          </label>
          <Button type="submit" size="lg" className="h-14 w-full text-[17px]">
            Accept invite
          </Button>
        </form>
      )}
    </main>
  );
}
