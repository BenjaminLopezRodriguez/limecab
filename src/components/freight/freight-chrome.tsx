"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type FreightProduct = "shipper" | "carrier" | "driver";

const LINKS = [
  { product: "shipper" as const, href: "/freight", label: "Ship" },
  { product: "carrier" as const, href: "/freight/carrier", label: "Carrier" },
  { product: "driver" as const, href: "/freight/driver", label: "App" },
  { product: null, href: "/partner", label: "Partners" },
] as const;

/**
 * Chrome for Lime Freight products that still share the phone product switcher.
 * Shipper desk uses `FreightShipperShell`; carrier portal uses `FreightPortalShell`.
 * Driver app uses this chrome in duty mode.
 */
export function FreightChrome({
  product,
  children,
  duty,
}: {
  product: FreightProduct;
  children: ReactNode;
  /** Full-bleed session (carrier hunt map, driver app). */
  duty?: boolean;
}) {
  const pathname = usePathname();
  const onDuty =
    duty !== undefined
      ? duty
      : product === "driver" ||
        (product === "carrier" && pathname === "/freight/carrier");

  const nav = (
    <nav
      aria-label="Freight products"
      className="flex items-center gap-1 text-[13px] font-semibold tracking-tight"
    >
      {LINKS.map((link) => {
        const current =
          (link.product !== null && link.product === product) ||
          (link.href === "/partner" && pathname.startsWith("/partner"));
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "rounded-full px-2.5 py-1.5 transition-colors",
              current
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );

  if (onDuty) {
    return (
      <div
        className="bg-background text-foreground"
        style={{ "--service-app-chrome": "0rem" } as React.CSSProperties}
      >
        {product !== "driver" ? (
          <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
            <Link
              href="/services"
              className="pointer-events-auto font-heading text-[17px] font-semibold tracking-[-0.03em]"
            >
              Lime <span className="text-lime">Freight</span>
            </Link>
            <div className="pointer-events-auto">{nav}</div>
          </header>
        ) : null}
        {children}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-5 pb-10 text-[16px]">
      <header className="bg-background sticky top-0 z-10 flex h-16 items-center justify-between gap-3">
        <Link
          href="/services"
          className="focus-visible:ring-ring font-heading rounded-lg text-[21px] font-semibold tracking-[-0.03em] focus-visible:ring-2 focus-visible:outline-none"
        >
          Lime <span className="text-lime">Freight</span>
        </Link>
        {nav}
      </header>
      {children}
    </div>
  );
}
