"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Shipper desk chrome — mobile compose stays phone-friendly; md+ unlocks
 * ServiceAppShell’s two-column home. Nav nouns: New move · Shipments
 * (not carrier Search/Fleet). Cross-product switcher lives on /partner.
 */
const NAV = [
  {
    href: "/freight",
    label: "New move",
    match: (p: string) => p === "/freight",
  },
  {
    href: "/freight/shipments",
    label: "Shipments",
    match: (p: string) => p.startsWith("/freight/shipments"),
  },
] as const;

export function FreightShipperShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const onCompose = pathname === "/freight";

  return (
    <div
      className={cn(
        "bg-background text-foreground min-h-dvh",
        // Mobile: brand row + pill strip. sm+: brand row only (desk nav inline).
        "[--service-app-chrome:7rem] sm:[--service-app-chrome:4rem]",
        "[--nav-pill-clear:1.5rem]",
      )}
    >
      <header className="border-border/80 bg-background/95 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-5 md:px-8">
          <div className="flex min-w-0 items-center gap-5">
            <Link
              href="/freight"
              className="font-heading shrink-0 text-[18px] font-semibold tracking-[-0.03em]"
            >
              Lime <span className="text-lime">Freight</span>
            </Link>
            <nav
              aria-label="Shipper"
              className="hidden items-center gap-1 sm:flex"
            >
              {NAV.map((item) => {
                const current = item.match(pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[13px] font-semibold tracking-tight transition-colors",
                      current
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <Link
            href="/partner"
            className="text-muted-foreground hover:text-foreground shrink-0 rounded-full px-2.5 py-1.5 text-[12px] font-semibold"
          >
            Partners
          </Link>
        </div>
        <nav
          aria-label="Shipper mobile"
          className="flex gap-1 px-3 pb-2 sm:hidden"
        >
          {NAV.map((item) => {
            const current = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold",
                  current
                    ? "bg-foreground text-background"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {onCompose ? (
        children
      ) : (
        <div className="mx-auto max-w-7xl px-5 py-6 md:px-8 md:py-8">
          {children}
        </div>
      )}
    </div>
  );
}
