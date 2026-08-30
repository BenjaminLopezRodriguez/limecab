"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { PartnerPlacesTabBar } from "@/components/partner/partner-places-tabs";

/**
 * Partner Places chrome — mirrors `DriverChrome`.
 *
 * `/partner/places/app` is the desk: map card + launcher, no document header.
 * Account, bookings, and earnings keep the padded column the driver uses.
 */
export function PartnerPlacesChrome({
  children,
  initial,
}: {
  children: ReactNode;
  initial: string;
}) {
  const pathname = usePathname();
  const onDesk =
    pathname === "/partner/places/app" ||
    pathname.startsWith("/partner/places/app/listings/");

  if (onDesk && pathname === "/partner/places/app") {
    return (
      <div
        className="bg-background text-foreground"
        style={
          { "--service-app-chrome": "0rem" } as React.CSSProperties
        }
      >
        {children}
      </div>
    );
  }

  if (onDesk) {
    return (
      <div
        className="bg-background text-foreground mx-auto max-w-md px-5 pb-10 text-[16px]"
        style={
          { "--service-app-chrome": "0rem" } as React.CSSProperties
        }
      >
        {children}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-5 pb-[7rem] text-[16px]">
      <header className="bg-background sticky top-0 z-10 flex h-16 items-center justify-between">
        <Link
          href="/partner/places/app"
          className="focus-visible:ring-ring rounded-lg text-[21px] font-semibold tracking-[-0.03em] focus-visible:ring-2 focus-visible:outline-none"
        >
          LimeCab <span className="text-lime">Places</span>
        </Link>
        <Link
          href="/partner/places/app/account"
          aria-label="Your account"
          className="bg-accent text-accent-foreground focus-visible:ring-ring flex size-10 items-center justify-center rounded-full text-sm font-semibold tracking-tight focus-visible:ring-2 focus-visible:outline-none"
        >
          {initial}
        </Link>
      </header>
      {children}
      <PartnerPlacesTabBar />
    </div>
  );
}
