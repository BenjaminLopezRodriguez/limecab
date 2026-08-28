"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { DriverTabBar } from "@/components/limecab/driver-tabs";

/**
 * Two products live under `/driver`.
 *
 * `/driver` itself is the duty session: a full-bleed map with a sheet over
 * it. A 4rem sticky header would eat the top of that canvas for no reason —
 * the account lives on an avatar drawn on the map instead.
 *
 * Everything else — profile, earnings, documents, safety, help — is account
 * paperwork and keeps the padded document column it already had.
 */
export function DriverChrome({
  children,
  initial,
}: {
  children: ReactNode;
  initial: string;
}) {
  const pathname = usePathname();

  if (pathname === "/driver") {
    return (
      <div
        className="bg-background text-foreground"
        style={
          // No chrome above the canvas: the map runs under the status bar.
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
          href="/driver"
          className="focus-visible:ring-ring rounded-lg text-[21px] font-semibold tracking-[-0.03em] focus-visible:ring-2 focus-visible:outline-none"
        >
          LimeCab <span className="text-lime">Driver</span>
        </Link>
        <Link
          href="/driver/profile"
          aria-label="Your profile"
          className="bg-accent text-accent-foreground focus-visible:ring-ring flex size-10 items-center justify-center rounded-full text-sm font-semibold tracking-tight focus-visible:ring-2 focus-visible:outline-none"
        >
          {initial}
        </Link>
      </header>
      {children}
      <DriverTabBar />
    </div>
  );
}
