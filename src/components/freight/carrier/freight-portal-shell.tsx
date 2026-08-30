"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Desktop carrier web portal chrome — Uber Freight portal IA:
 * Search · Saved Lanes · My Loads · Fleet Management
 */
const NAV = [
  { href: "/freight/carrier", label: "Search", match: (p: string) => p === "/freight/carrier" },
  {
    href: "/freight/carrier/lanes",
    label: "Saved Lanes",
    match: (p: string) => p.startsWith("/freight/carrier/lanes"),
  },
  {
    href: "/freight/carrier/loads",
    label: "My Loads",
    match: (p: string) =>
      p === "/freight/carrier/loads" ||
      (p.startsWith("/freight/carrier/loads/") && !p.includes("lanes")),
  },
  {
    href: "/freight/carrier/fleet",
    label: "Fleet Management",
    match: (p: string) => p.startsWith("/freight/carrier/fleet"),
  },
] as const;

export function FreightPortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="bg-background text-foreground min-h-dvh">
      <header className="border-border/80 bg-background/95 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-8">
          <div className="flex items-center gap-6">
            <Link
              href="/freight/carrier"
              className="font-heading text-[18px] font-semibold tracking-[-0.03em]"
            >
              Lime <span className="text-lime">Freight</span>
              <span className="text-muted-foreground ml-2 text-[12px] font-medium tracking-normal">
                Portal
              </span>
            </Link>
            <nav
              aria-label="Carrier portal"
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
          <div className="flex items-center gap-2 text-[12px] font-semibold">
            <Link
              href="/freight/driver"
              className="text-muted-foreground hover:text-foreground rounded-full px-2.5 py-1.5"
            >
              App
            </Link>
            <Link
              href="/freight"
              className="text-muted-foreground hover:text-foreground rounded-full px-2.5 py-1.5"
            >
              Ship
            </Link>
            <Link
              href="/partner"
              className="text-muted-foreground hover:text-foreground rounded-full px-2.5 py-1.5"
            >
              Partners
            </Link>
          </div>
        </div>
        <nav
          aria-label="Carrier portal mobile"
          className="border-border flex gap-1 overflow-x-auto border-t px-3 py-2 sm:hidden"
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
      <div className="mx-auto max-w-6xl px-5 py-6 md:px-8 md:py-8">{children}</div>
    </div>
  );
}
