"use client";

import { useCallback, useState, type ReactNode, Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clock01Icon,
  DashboardSquare01Icon,
  Home01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";

import { LimeCabApp } from "@/components/limecab/limecab-app";
import { LimeCabTripPill } from "@/components/limecab/limecab-trip-pill";
import { Icon } from "@/components/ui/icon";
import type { ServiceAppState } from "@/lib/service-app/state";
import { cn } from "@/lib/utils";

/**
 * The app frame: a greeting, the tab the rider is in, and the tab bar.
 *
 * Every tab but Home is a real route; this shell lives in the root layout so
 * the ride flow stays mounted across those navigations — leaving Activity and
 * coming back must not reset a destination the rider already chose. The tab
 * bar hides itself once the rider is inside a ride task, because a request in
 * progress owns the screen; that is the only thing the ride flow tells the
 * shell.
 */

const TABS = [
  { href: "/", label: "Home", icon: Home01Icon },
  { href: "/services", label: "Services", icon: DashboardSquare01Icon },
  { href: "/activity", label: "Activity", icon: Clock01Icon },
  { href: "/profile", label: "Profile", icon: UserIcon },
] as const;

export function LimeCabShell({
  children,
  riderName,
  signedIn = false,
}: {
  children: ReactNode;
  /** The session's name, or null when nobody is signed in. */
  riderName?: string | null;
  signedIn?: boolean;
}) {
  const pathname = usePathname();
  const [scene, setScene] = useState<ServiceAppState>("home");

  // Stable identity: the ride flow reports its scene from an effect.
  const onSceneChange = useCallback((next: ServiceAppState) => {
    setScene(next);
  }, []);

  // The driver app is its own product with its own chrome.
  if (pathname.startsWith("/driver")) return <>{children}</>;

  if (pathname.startsWith("/signin")) {
    return (
      <main id="limecab-main" className="bg-background text-foreground min-h-dvh">
        {children}
      </main>
    );
  }

  const onHome = pathname === "/";
  const inTask = scene !== "home";
  const showChrome = !onHome || !inTask;

  return (
    <main
      id="limecab-main"
      className="bg-background text-foreground"
      style={
        {
          // Header only — the tab capsule floats and does not consume layout.
          "--service-app-chrome": showChrome ? "3.75rem" : "0rem",
          "--nav-pill-clear": "8rem",
        } as React.CSSProperties
      }
    >
      {showChrome ? (
        <header className="flex h-[3.75rem] items-center justify-between px-5 md:px-6">
          <p className="font-heading text-[19px] font-semibold tracking-[-0.03em]">
            {signedIn ? (
              <>
                Hello, <span className="text-lime">{riderName ?? "there"}</span>
              </>
            ) : (
              "LimeCab"
            )}
          </p>
          {signedIn ? null : (
            <Link
              href="/signin"
              className="focus-visible:ring-ring rounded-full px-3 py-1.5 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
            >
              Sign in
            </Link>
          )}
        </header>
      ) : null}

      {/* Never unmounted: a half-chosen ride survives a trip to Activity. */}
      <div className={cn(!onHome && "hidden")}>
        <Suspense fallback={null}>
          <LimeCabApp
            onSceneChange={onSceneChange}
            signedIn={signedIn}
            // Off Home the ride is the pill, so render no surfaces at all: the
            // sheet portals to <body> and would otherwise escape `hidden`.
            minimized={!onHome}
          />
        </Suspense>
      </div>

      {onHome ? null : children}

      {/* Off the ride screen, a live ride is a draggable pill, not a sheet. */}
      {onHome ? null : <LimeCabTripPill />}

      {showChrome ? <TabBar pathname={pathname} /> : null}
    </main>
  );
}

/**
 * A floating capsule, not a docked bar: it sits *over* the content so the map
 * and lists run to the bottom edge of the screen. The active tab is a filled
 * pill inside the capsule — the selected state has to survive being read at a
 * glance, and a colour change alone does not.
 */
function TabBar({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 flex justify-center px-4"
    >
      <ul className="bg-card/90 ring-border flex items-center gap-1 rounded-full p-1.5 shadow-[0_8px_28px_rgba(26,24,20,0.12)] ring-1 backdrop-blur-xl">
        {TABS.map(({ href, label, icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring flex min-h-[3.25rem] min-w-[4.5rem] flex-col items-center justify-center gap-1 rounded-full px-3 transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon
                  icon={icon}
                  size={22}
                  strokeWidth={active ? 2 : 1.5}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    "text-[11px] leading-none tracking-tight",
                    active && "font-medium",
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

/** Tabs other than Home are plain scrolling pages, not task surfaces. */
export function TabPageFrame({ children }: { children: ReactNode }) {
  return (
    // pb clears the floating tab capsule, which no longer reserves layout space.
    <div className="min-h-[calc(100dvh-3.75rem)] px-5 pb-[var(--nav-pill-clear,8rem)] md:mx-auto md:max-w-2xl md:px-6">
      {children}
    </div>
  );
}

export function TabPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <TabPageFrame>
      <h1 className="font-heading text-[34px] leading-none font-bold tracking-[-0.035em]">
        {title}
      </h1>
      <div className="mt-7">{children}</div>
    </TabPageFrame>
  );
}
