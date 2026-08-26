"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Moon, Navigation, Power } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/service-app/services";
import { api } from "@/trpc/react";

/** Ride states a driver can be mid-job in, in the words a driver uses. */
const ACTIVE_LABEL: Record<string, string> = {
  matched: "Head to pickup",
  arriving: "At the curb",
  in_progress: "Rider on board",
};

export default function DriverInboxPage() {
  const inbox = api.driver.inbox.useQuery(undefined, {
    refetchInterval: 4_000,
  });
  const setAvailable = api.driver.setAvailable.useMutation({
    onSuccess: () => void inbox.refetch(),
  });

  if (inbox.error) {
    return (
      <p role="alert" className="mt-8 text-[17px]">
        Couldn’t load your inbox. {inbox.error.message}
      </p>
    );
  }

  if (!inbox.data) {
    return (
      <div className="mt-6" aria-busy="true">
        <div className="bg-muted h-40 w-full animate-pulse rounded-3xl" />
        <div className="bg-muted mt-6 h-28 w-full animate-pulse rounded-3xl" />
        <span className="sr-only">Loading your inbox</span>
      </div>
    );
  }

  if (!inbox.data.driver) {
    return <RegisterForm onDone={() => void inbox.refetch()} />;
  }

  const available = inbox.data.driver.available;
  const { open, active } = inbox.data;

  return (
    <>
      {/* Duty state is the loudest thing on the screen: the whole panel
          changes colour, not just the button. */}
      <section
        className={
          available
            ? "bg-accent text-accent-foreground ring-primary/40 rounded-3xl p-5 ring-2"
            : "bg-muted text-foreground ring-border rounded-3xl p-5 ring-1"
        }
      >
        <div className="flex items-center gap-2.5">
          <span
            className={
              available
                ? "bg-primary size-3 shrink-0 animate-pulse rounded-full"
                : "bg-muted-foreground/60 size-3 shrink-0 rounded-full"
            }
            aria-hidden="true"
          />
          <p className="text-xs font-semibold tracking-[0.14em] uppercase">
            {available ? "Online" : "Off duty"}
          </p>
        </div>
        <p className="mt-2.5 text-3xl font-semibold tracking-[-0.03em]">
          {available ? "You’re taking rides" : "You’re not taking rides"}
        </p>
        <p
          className={
            available
              ? "mt-1.5 text-[15px] opacity-80"
              : "text-muted-foreground mt-1.5 text-[15px]"
          }
        >
          {available
            ? "Requests arrive here on their own. Keep the app open."
            : "Nothing is offered to you until you go online."}
        </p>
        <Button
          size="lg"
          variant={available ? "outline" : "default"}
          className="mt-5 h-16 w-full text-[17px]"
          aria-busy={setAvailable.isPending || undefined}
          disabled={setAvailable.isPending}
          onClick={() => setAvailable.mutate({ available: !available })}
        >
          <Power className="size-5" aria-hidden="true" strokeWidth={2} />
          {available ? "Go offline" : "Go online"}
        </Button>
      </section>
      {setAvailable.error ? (
        <p role="alert" className="text-destructive mt-3 text-[15px]">
          Couldn’t change your status. {setAvailable.error.message}
        </p>
      ) : null}

      <Section title="New rides">
        {open.length === 0 ? (
          available ? (
            <Empty
              icon={<Navigation className="size-6" aria-hidden="true" />}
              title="Waiting for requests"
            >
              This list updates on its own — no need to refresh.
            </Empty>
          ) : (
            <Empty
              icon={<Moon className="size-6" aria-hidden="true" />}
              title="No rides come in while you’re offline"
            >
              Go online above and new requests will show up here.
            </Empty>
          )
        ) : (
          <ul className="space-y-3">
            {open.map((trip) => (
              <li key={trip.id}>
                <Link
                  href={`/driver/trips/${trip.id}`}
                  className="ring-border hover:bg-muted/50 focus-visible:ring-ring block rounded-3xl px-5 py-5 ring-1 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-4xl font-semibold tracking-[-0.03em] tabular-nums">
                      {formatMoney(trip.totalCents)}
                    </p>
                    <p className="text-muted-foreground shrink-0 text-[15px] tabular-nums">
                      {trip.distanceMiles.toFixed(1)} mi · {trip.tripMinutes}{" "}
                      min
                    </p>
                  </div>
                  <p className="mt-1 text-[15px] font-medium tabular-nums">
                    {trip.arrivalMinutes
                      ? `${trip.arrivalMinutes} min to pickup`
                      : "Pickup nearby"}
                  </p>

                  <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-3.5">
                    <span
                      className="border-foreground mt-1.5 size-3 rounded-full border-[3px]"
                      aria-hidden="true"
                    />
                    <p className="text-[17px] leading-snug font-medium tracking-tight">
                      {trip.pickupAddress}
                    </p>
                    <span
                      className="bg-border mx-auto my-1 h-6 w-0.5 rounded-full"
                      aria-hidden="true"
                    />
                    <span aria-hidden="true" />
                    <span
                      className="bg-foreground mt-1.5 size-3 rounded-[3px]"
                      aria-hidden="true"
                    />
                    <p className="text-muted-foreground text-[17px] leading-snug tracking-tight">
                      {trip.destinationAddress}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Active">
        {active.length === 0 ? (
          <Empty title="Nothing in progress">
            Accept a ride and it shows up here.
          </Empty>
        ) : (
          <ul className="divide-border ring-border divide-y rounded-3xl ring-1">
            {active.map((trip) => (
              <li key={trip.id}>
                <Link
                  href={`/driver/trips/${trip.id}`}
                  className="focus-visible:ring-ring flex min-h-16 items-center gap-3 px-5 py-4 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-primary text-xs font-semibold tracking-[0.12em] uppercase">
                      {ACTIVE_LABEL[trip.status] ?? trip.status}
                    </p>
                    <p className="mt-1 truncate text-[17px] font-medium tracking-tight">
                      {trip.destinationAddress}
                    </p>
                    <p className="text-muted-foreground truncate text-[15px]">
                      from {trip.pickupAddress}
                    </p>
                  </div>
                  <p className="shrink-0 text-[17px] font-semibold tabular-nums">
                    {formatMoney(trip.totalCents)}
                  </p>
                  <ChevronRight
                    className="text-muted-foreground size-5 shrink-0"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Empty({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ring-border rounded-3xl px-5 py-8 text-center ring-1">
      {icon ? (
        <p className="text-muted-foreground flex justify-center">{icon}</p>
      ) : null}
      <p className="mt-3 text-[17px] font-medium tracking-tight">{title}</p>
      <p className="text-muted-foreground mx-auto mt-1 max-w-[26ch] text-[15px]">
        {children}
      </p>
    </div>
  );
}

const FIELDS = [
  {
    name: "name",
    label: "Your name",
    autoComplete: "name",
    placeholder: "Alex Rivera",
    span: true,
  },
  {
    name: "vehicleMake",
    label: "Make",
    autoComplete: "off",
    placeholder: "Toyota",
    span: false,
  },
  {
    name: "vehicleModel",
    label: "Model",
    autoComplete: "off",
    placeholder: "Prius",
    span: false,
  },
  {
    name: "vehicleColor",
    label: "Colour",
    autoComplete: "off",
    placeholder: "Silver",
    span: false,
  },
  {
    name: "vehiclePlate",
    label: "Plate",
    autoComplete: "off",
    placeholder: "8ABC123",
    span: false,
  },
] as const;

function RegisterForm({ onDone }: { onDone: () => void }) {
  const [values, setValues] = useState({
    name: "",
    vehicleMake: "",
    vehicleModel: "",
    vehicleColor: "",
    vehiclePlate: "",
  });
  const register = api.driver.register.useMutation({ onSuccess: onDone });

  return (
    <form
      className="mt-2"
      onSubmit={(event) => {
        event.preventDefault();
        register.mutate(values);
      }}
    >
      <h1 className="text-3xl font-semibold tracking-[-0.03em]">
        Drive with us
      </h1>
      <p className="text-muted-foreground mt-2 text-[15px]">
        Riders look for your name and your car at the curb, so get these right.
      </p>

      <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-5">
        {FIELDS.map((field) => (
          <div
            key={field.name}
            className={field.span ? "col-span-2" : "col-span-1"}
          >
            <label
              htmlFor={`driver-${field.name}`}
              className="mb-1.5 block text-[15px] font-medium tracking-tight"
            >
              {field.label}
            </label>
            <Input
              id={`driver-${field.name}`}
              required
              autoComplete={field.autoComplete}
              placeholder={field.placeholder}
              autoCapitalize={
                field.name === "vehiclePlate" ? "characters" : "words"
              }
              spellCheck={false}
              value={values[field.name]}
              onChange={(event) =>
                setValues((prev) => ({
                  ...prev,
                  [field.name]: event.target.value,
                }))
              }
              className="h-14 w-full text-[17px]"
            />
          </div>
        ))}
      </div>

      {register.error ? (
        <p role="alert" className="text-destructive mt-4 text-[15px]">
          Couldn’t register you. {register.error.message}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="mt-7 h-16 w-full text-[17px]"
        aria-busy={register.isPending || undefined}
        disabled={register.isPending}
      >
        {register.isPending ? "Registering…" : "Start driving"}
      </Button>
    </form>
  );
}
