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
 * The driver's tab bar — a docked bar, not the rider's floating capsule.
 *
 * It exists on the two surfaces where the driver is *not* driving: off-duty
 * home and the account pages. A dash does not get a tab bar: on the hunting
 * canvas, during an offer, and inside a job, this is not rendered at all.
 *
 * Four tabs, because we have four places. There is no Discover and no Inbox.
 */
export const DRIVER_TAB_HEIGHT = "5.5rem";

const TABS = [
  { id: "home", href: "/driver", label: "Home", icon: Home01Icon },
  { id: "trends", href: "/driver?trends=1", label: "Trends", icon: Analytics01Icon },
  {
    id: "earnings",
    href: "/driver/profile/earnings",
    label: "Earnings",
    icon: Wallet01Icon,
  },
  {
    id: "account",
    href: "/driver/profile",
    label: "Account",
    icon: UserCircleIcon,
  },
] as const;

export function DriverTabBar({
  active,
  onTrends,
}: {
  /** Which tab reads as current. Omit to derive it from the path. */
  active?: (typeof TABS)[number]["id"];
  /**
   * Trends is an aside on the duty map, not a route. When the driver is
   * already on `/driver`, opening it is this call rather than a navigation.
   */
  onTrends?: () => void;
}) {
  const pathname = usePathname();
  const current =
    active ??
    (pathname === "/driver"
      ? "home"
      : pathname === "/driver/profile/earnings"
        ? "earnings"
        : "account");

  return (
    <nav
      aria-label="Driver sections"
      className="bg-card border-border fixed inset-x-0 bottom-0 z-30 border-t"
      style={{ height: DRIVER_TAB_HEIGHT }}
    >
      <ul className="mx-auto flex h-full max-w-md items-start justify-around pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {TABS.map(({ id, href, label, icon }) => {
          const isCurrent = id === current;
          const className = cn(
            "focus-visible:ring-ring flex min-h-[3.25rem] min-w-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl px-2 focus-visible:ring-2 focus-visible:outline-none",
            isCurrent ? "text-foreground" : "text-muted-foreground",
          );
          const content = (
            <>
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
            </>
          );
          return (
            <li key={id}>
              {id === "trends" && onTrends ? (
                <button type="button" onClick={onTrends} className={className}>
                  {content}
                </button>
              ) : (
                <Link
                  href={href}
                  aria-current={isCurrent ? "page" : undefined}
                  className={className}
                >
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
