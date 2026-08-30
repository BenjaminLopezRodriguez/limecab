import Link from "next/link";
import {
  DeliveryTruck01Icon,
  Store01Icon,
  ContainerTruckIcon,
  UserGroupIcon,
  Car01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/**
 * Partner gateway — Uber-style multi-destination chooser.
 * Operating model only: separate products, not one role-toggle app.
 * Do not copy Uber visual design or proprietary wording.
 */

type PartnerDest = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: IconSvgElement;
  badge?: string;
};

/**
 * Mirrors Uber’s split logins / hubs:
 * Drive app · Fleet Hub · Freight Shipping · Freight Carrier · Merchant signup
 */
const DESTINATIONS: PartnerDest[] = [
  {
    id: "drive",
    title: "Drive",
    description: "Rides, courier, help — Lime’s general driver app.",
    href: "/driver",
    icon: Car01Icon,
  },
  {
    id: "freight-app",
    title: "Freight app",
    description: "Book loads, my loads, drivers, account — on the road.",
    href: "/freight/driver",
    icon: DeliveryTruck01Icon,
  },
  {
    id: "fleets",
    title: "Fleets",
    description: "Fleet hub: invite drivers, manage access, open carrier tools.",
    href: "/partner/fleets",
    icon: UserGroupIcon,
  },
  {
    id: "freight-ship",
    title: "Freight shipping",
    description: "Shipper tools — quote, publish, and track full truckload.",
    href: "/freight",
    icon: DeliveryTruck01Icon,
  },
  {
    id: "freight-carrier",
    title: "Freight carrier",
    description: "Desktop portal — search, book, assign, dispatch.",
    href: "/freight/carrier",
    icon: ContainerTruckIcon,
  },
  {
    id: "merchants",
    title: "Merchants",
    description: "List your store for Lime Shop. Interest form to get started.",
    href: "/partner/merchants",
    icon: Store01Icon,
    badge: "Interest",
  },
];

export default function PartnerPage() {
  return (
    <main className="bg-background text-foreground relative min-h-dvh overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, color-mix(in oklch, var(--lime) 28%, transparent), transparent 70%), linear-gradient(165deg, var(--background) 0%, color-mix(in oklch, var(--accent) 40%, var(--background)) 100%)",
        }}
      />

      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 pb-12 pt-[max(2rem,env(safe-area-inset-top))] md:px-8 md:pb-16">
        <header className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="font-heading text-[18px] font-semibold tracking-[-0.03em]"
          >
            Lime<span className="text-lime">Cab</span>
          </Link>
          <Link
            href="/signin"
            className="text-muted-foreground text-[13px] font-semibold tracking-tight underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </header>

        {/* Phone: stacked chooser. Desktop: intro column + destination grid. */}
        <div className="mt-10 flex flex-1 flex-col md:mt-14 md:grid md:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)] md:items-start md:gap-12 lg:gap-16">
          <div className="md:sticky md:top-8">
            <p className="text-lime font-heading text-[13px] font-semibold tracking-[0.08em] uppercase">
              Partners
            </p>
            <h1 className="font-heading mt-2 text-[2.5rem] leading-[1.05] font-semibold tracking-[-0.04em] md:text-[2.75rem]">
              Choose how you work with Lime
            </h1>
            <p className="text-muted-foreground mt-3 max-w-sm text-[16px] leading-relaxed">
              Separate products for drivers, fleets, freight, and merchants —
              pick your entry point.
            </p>
            <p className="text-muted-foreground mt-8 hidden text-[13px] leading-relaxed md:block">
              Looking to move freight as a business? Start with{" "}
              <Link
                href="/freight"
                className="text-foreground font-medium underline-offset-2 hover:underline"
              >
                Freight shipping
              </Link>
              . Carriers use{" "}
              <Link
                href="/freight/carrier"
                className="text-foreground font-medium underline-offset-2 hover:underline"
              >
                Freight carrier
              </Link>
              .
            </p>
          </div>

          <div className="mt-10 flex min-h-0 flex-1 flex-col md:mt-0">
            <ul className="grid gap-3 sm:grid-cols-2">
              {DESTINATIONS.map((dest) => (
                <li key={dest.id} className="min-h-0">
                  <DestCard dest={dest} />
                </li>
              ))}
            </ul>

            <p className="text-muted-foreground mt-auto pt-10 text-[13px] leading-relaxed md:hidden">
              Looking to move freight as a business? Start with{" "}
              <Link
                href="/freight"
                className="text-foreground font-medium underline-offset-2 hover:underline"
              >
                Freight shipping
              </Link>
              . Carriers use{" "}
              <Link
                href="/freight/carrier"
                className="text-foreground font-medium underline-offset-2 hover:underline"
              >
                Freight carrier
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function DestCard({ dest }: { dest: PartnerDest }) {
  return (
    <Link
      href={dest.href}
      className={cn(
        "bg-card ring-border flex h-full w-full items-start gap-4 rounded-3xl p-4 text-left ring-1 transition-colors sm:p-5",
        "hover:bg-accent/40 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
      )}
    >
      <span
        aria-hidden
        className="bg-accent text-accent-foreground flex size-12 shrink-0 items-center justify-center rounded-2xl"
      >
        <Icon icon={dest.icon} size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-heading text-[18px] font-semibold tracking-[-0.02em]">
            {dest.title}
          </span>
          {dest.badge ? (
            <span className="bg-secondary text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-tight">
              {dest.badge}
            </span>
          ) : null}
        </span>
        <span className="text-muted-foreground mt-0.5 block text-[14px] leading-snug">
          {dest.description}
        </span>
      </span>
    </Link>
  );
}
