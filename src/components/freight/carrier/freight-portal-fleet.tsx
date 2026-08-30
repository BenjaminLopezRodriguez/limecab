"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { freight } from "@/components/freight/freight-api";
import { Empty } from "@/components/freight/freight-parts";

/**
 * Fleet Management — add/remove members (Uber portal Add Member shape).
 */
export function FreightPortalFleet() {
  const fleet = freight.listFleet.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const add = freight.addFleetMember.useMutation({
    onSuccess: () => {
      setEmail("");
      setName("");
      void fleet.refetch();
    },
  });
  const remove = freight.removeFleetMember.useMutation({
    onSuccess: () => void fleet.refetch(),
  });

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"DRIVER" | "DISPATCHER">("DRIVER");

  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
        Fleet Management
      </h1>
      <p className="text-muted-foreground mt-1 text-[15px]">
        Add drivers and dispatchers. Owner can manage membership.
      </p>

      <form
        className="bg-card ring-border mt-6 grid gap-3 rounded-2xl p-4 ring-1 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate({ email, name: name || undefined, role });
        }}
      >
        <h2 className="font-heading md:col-span-2 text-[17px] font-semibold">
          Add member
        </h2>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium">Name</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11"
            placeholder="Alex Rivera"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium">Email *</span>
          <Input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
            placeholder="driver@example.com"
          />
        </label>
        <fieldset className="md:col-span-2">
          <legend className="mb-1.5 text-[13px] font-medium">Role</legend>
          <div className="flex gap-2">
            {(["DRIVER", "DISPATCHER"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={
                  role === r
                    ? "bg-foreground text-background rounded-full px-3.5 py-2 text-[13px] font-semibold"
                    : "bg-secondary text-muted-foreground rounded-full px-3.5 py-2 text-[13px] font-semibold"
                }
              >
                {r === "DRIVER" ? "Driver" : "Dispatcher"}
              </button>
            ))}
          </div>
          <p className="text-muted-foreground mt-2 text-[12px]">
            Drivers can see rates and book from the Freight app when permitted.
          </p>
        </fieldset>
        <Button
          type="submit"
          className="h-11 md:col-span-2 md:max-w-xs"
          disabled={add.isPending}
        >
          {add.isPending ? "Saving…" : "Save"}
        </Button>
        {add.error ? (
          <p role="alert" className="text-destructive md:col-span-2 text-[13px]">
            {add.error.message}
          </p>
        ) : null}
      </form>

      <h2 className="font-heading mt-10 text-[17px] font-semibold">Members</h2>
      {fleet.isLoading ? (
        <div className="bg-muted mt-3 h-24 animate-pulse rounded-2xl" />
      ) : !fleet.data?.members.length ? (
        <Empty className="mt-3">No members.</Empty>
      ) : (
        <ul className="mt-3 divide-y divide-border rounded-2xl ring-1 ring-border">
          {fleet.data.members.map((m) => (
            <li
              key={m.id}
              className="bg-card flex flex-wrap items-center justify-between gap-3 px-4 py-3.5"
            >
              <div>
                <p className="text-[15px] font-semibold">
                  {m.user?.name ?? "Member"} · {m.role}
                </p>
                <p className="text-muted-foreground text-[13px]">
                  {m.user?.email ?? m.userId}
                </p>
              </div>
              {m.role !== "OWNER" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ memberId: m.id })}
                >
                  Remove
                </Button>
              ) : (
                <span className="text-muted-foreground text-[12px]">Owner</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <h2 className="font-heading mt-10 text-[17px] font-semibold">Vehicles</h2>
      {!fleet.data?.vehicles.length ? (
        <Empty className="mt-3">No vehicles. Seed adds DV-101.</Empty>
      ) : (
        <ul className="mt-3 space-y-2">
          {fleet.data.vehicles.map((v) => (
            <li
              key={v.id}
              className="bg-card ring-border rounded-2xl px-4 py-3 text-[14px] ring-1"
            >
              <span className="font-semibold">{v.unitNumber}</span>
              <span className="text-muted-foreground">
                {" "}
                · {v.equipmentType} · {v.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
