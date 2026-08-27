"use client";

import { useState } from "react";

import { DriverApp } from "@/components/limecab/driver-app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/trpc/react";

/**
 * `/driver` is the whole driving product: duty, the offer, and the live job,
 * on one map. It is not an inbox and it never navigates away to a job page.
 *
 * The only thing that is still a document is registration — until there is a
 * driver row there is nothing to put on a map.
 */
export default function DriverPage() {
  const inbox = api.driver.inbox.useQuery(undefined, {
    // The app owns polling once it is up; this first read just decides which
    // of the two products to render.
    refetchOnWindowFocus: false,
  });

  if (inbox.error) {
    return (
      <Document>
        <p role="alert" className="mt-8 text-[17px]">
          Couldn’t load your driver account. {inbox.error.message}
        </p>
      </Document>
    );
  }

  if (!inbox.data) {
    return (
      <Document>
        <div className="mt-6" aria-busy="true">
          <div className="bg-muted h-40 w-full animate-pulse rounded-3xl" />
          <div className="bg-muted mt-6 h-28 w-full animate-pulse rounded-3xl" />
          <span className="sr-only">Loading your driver account</span>
        </div>
      </Document>
    );
  }

  if (!inbox.data.driver) {
    return (
      <Document>
        <RegisterForm onDone={() => void inbox.refetch()} />
      </Document>
    );
  }

  return (
    <DriverApp
      driverInitial={(inbox.data.driver.name || "D").charAt(0).toUpperCase()}
    />
  );
}

/** The padded column the map product deliberately does not use. */
function Document({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-5 pb-10 text-[16px]">{children}</div>
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
      className="pt-6"
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
