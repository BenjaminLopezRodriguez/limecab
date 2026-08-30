"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Chow interest form — restaurant partners for Lime Chow.
 * No persistence / sales CRM yet.
 */
export default function PartnerChowPage() {
  const [sent, setSent] = useState(false);
  const [values, setValues] = useState({
    restaurantName: "",
    city: "",
    contact: "",
    phone: "",
  });

  return (
    <main className="bg-background text-foreground mx-auto flex min-h-dvh max-w-3xl flex-col px-5 pb-12 pt-[max(2rem,env(safe-area-inset-top))] md:px-8 md:pb-16">
      <Link
        href="/partner"
        className="text-muted-foreground text-[14px] font-medium underline-offset-2 hover:underline"
      >
        ← Partners
      </Link>

      <h1 className="font-heading mt-8 text-3xl font-semibold tracking-[-0.03em] md:text-4xl">
        Chow
      </h1>
      <p className="text-muted-foreground mt-3 max-w-xl text-[15px] leading-relaxed">
        List your restaurant for Lime Chow. Share a few details — we’ll review
        before restaurant tools go live.
      </p>

      {sent ? (
        <div className="bg-accent text-accent-foreground mt-8 max-w-xl rounded-3xl px-4 py-5 text-[15px] leading-relaxed">
          Interest received for {values.restaurantName || "your restaurant"}. A
          Chow portal is not live yet; this stages the partnership request.
          <Link
            href="/partner"
            className="mt-4 block font-semibold underline-offset-2 hover:underline"
          >
            Back to partners
          </Link>
        </div>
      ) : (
        <form
          className="mt-8 max-w-xl space-y-5 md:grid md:max-w-2xl md:grid-cols-2 md:gap-x-4 md:gap-y-5 md:space-y-0"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          {(
            [
              {
                key: "restaurantName" as const,
                label: "Restaurant name",
                placeholder: "Harbor Kitchen",
                autoComplete: "organization",
                span: true,
              },
              {
                key: "city" as const,
                label: "City",
                placeholder: "Los Angeles",
                autoComplete: "address-level2",
                span: false,
              },
              {
                key: "contact" as const,
                label: "Contact name",
                placeholder: "Sam Lee",
                autoComplete: "name",
                span: false,
              },
              {
                key: "phone" as const,
                label: "Phone",
                placeholder: "+1 555 0100",
                autoComplete: "tel",
                span: true,
              },
            ] as const
          ).map((field) => (
            <label
              key={field.key}
              className={cn("block", field.span && "md:col-span-2")}
            >
              <span className="mb-1.5 block text-[15px] font-medium">
                {field.label}
              </span>
              <Input
                required
                autoComplete={field.autoComplete}
                placeholder={field.placeholder}
                value={values[field.key]}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    [field.key]: e.target.value,
                  }))
                }
                className="h-14 text-[17px]"
              />
            </label>
          ))}
          <Button
            type="submit"
            size="lg"
            className="h-14 w-full text-[17px] md:col-span-2"
          >
            Submit interest
          </Button>
        </form>
      )}
    </main>
  );
}
