"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Analytics01Icon,
  Home01Icon,
  UserCircleIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/**
 * Partner Places tab bar — docked like Driver, not the rider floating capsule.
 *
 * Rendered on the home desk and account paperwork routes. Hidden while a
 * booking sheet would cover it (future).
 */
export const PLACES_TAB_HEIGHT = "5.5rem";

const TABS = [
  { id: "home", href: "/partner/places/app", label: "Home", icon: Home01Icon },
  {
    id: "bookings",
    href: "/partner/places/app/bookings",
    label: "Bookings",
    icon: Analytics01Icon,
  },
  {
    id: "earnings",
    href: "/partner/places/app/earnings",
    label: "Earnings",
    icon: Wallet01Icon,
  },
  {
    id: "account",
    href: "/partner/places/app/account",
    label: "Account",
    icon: UserCircleIcon,
  },
] as const;

export function PartnerPlacesTabBar({
  active,
}: {
  active?: (typeof TABS)[number]["id"];
}) {
  const pathname = usePathname();
  const current =
    active ??
    (pathname === "/partner/places/app"
      ? "home"
      : pathname.startsWith("/partner/places/app/bookings")
        ? "bookings"
        : pathname.startsWith("/partner/places/app/earnings")
          ? "earnings"
          : "account");

  return (
    <nav
      aria-label="Places sections"
      className="bg-card border-border fixed inset-x-0 bottom-0 z-30 border-t"
      style={{ height: PLACES_TAB_HEIGHT }}
    >
      <ul className="mx-auto flex h-full max-w-md items-start justify-around pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {TABS.map(({ id, href, label, icon }) => {
          const isCurrent = id === current;
          return (
            <li key={id}>
              <Link
                href={href}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring flex min-h-[3.25rem] min-w-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl px-2 focus-visible:ring-2 focus-visible:outline-none",
                  isCurrent ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon
                  icon={icon}
                  size={23}
                  strokeWidth={isCurrent ? 2 : 1.5}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    "text-[11px] leading-none tracking-tight",
                    isCurrent && "font-semibold",
                  )}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
