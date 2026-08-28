"use client";

import { useCallback, useState, type ReactNode, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Calendar03Icon,
  Car01Icon,
  Clock01Icon,
  DashboardSquare01Icon,
  Home01Icon,
  Package01Icon,
  UserIcon,
  WheelchairIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

import { LimeCabApp } from "@/components/limecab/limecab-app";
import { LimeCabTripPill } from "@/components/limecab/limecab-trip-pill";
import { Icon } from "@/components/ui/icon";
import { LIMECAB_SERVICES } from "@/lib/limecab/mock";
import { cn } from "@/lib/utils";

/**
 * The app frame: a greeting, a ribbon of services, the tab the rider is in,
 * and the tab bar.
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
  const [inTask, setInTask] = useState(false);

  // Stable identity: the ride flow reports from an effect. A minimized live
  // ride is not a task — Home, the launcher and the tabs all come back.
  const onTaskChange = useCallback((next: boolean) => {
    setInTask(next);
  }, []);

  // The driver app is its own product with its own chrome.
  if (pathname.startsWith("/driver")) return <>{children}</>;

  if (pathname.startsWith("/signin")) {
    return (
      <main
        id="limecab-main"
        className="bg-background text-foreground min-h-dvh"
      >
        {children}
      </main>
    );
  }

  const onHome = pathname === "/";
  const showChrome = !onHome || !inTask;

  return (
    <main
      id="limecab-main"
      className={cn(
        "bg-background text-foreground [--nav-pill-clear:8rem]",
        // Mobile stacks the service ribbon under the greeting.
        showChrome
          ? "[--service-app-chrome:7.5rem] md:[--service-app-chrome:3.75rem]"
          : "[--service-app-chrome:0rem]",
      )}
    >
      {showChrome ? (
        <header className="grid h-[7.5rem] grid-cols-[1fr_auto] grid-rows-[3.75rem_3.75rem] items-center gap-x-3 px-5 md:h-[3.75rem] md:grid-cols-[1fr_auto_auto] md:grid-rows-1 md:px-6">
          <div className="col-span-2 row-start-1 flex items-center justify-between gap-3 md:col-span-1 md:col-start-1">
            <p className="font-heading text-[19px] font-semibold tracking-[-0.03em]">
              {signedIn ? (
                <>
                  Hello,{" "}
                  <span className="text-lime">{riderName ?? "there"}</span>
                </>
              ) : (
                "LimeCab"
              )}
            </p>
            {signedIn ? null : (
              <SignInLink className="flex shrink-0 md:hidden" />
            )}
          </div>
          <div className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1">
            <Suspense fallback={<ServiceRibbonList activeId={null} />}>
              <ServiceRibbon />
            </Suspense>
          </div>
          {signedIn ? null : (
            <SignInLink className="hidden md:col-start-3 md:row-start-1 md:inline-flex" />
          )}
        </header>
      ) : null}

      {/* Never unmounted: a half-chosen ride survives a trip to Activity. */}
      <div className={cn(!onHome && "hidden")}>
        <Suspense fallback={null}>
          <LimeCabApp
            onTaskChange={onTaskChange}
            signedIn={signedIn}
            // Off Home the ride is the pill, so render no surfaces at all: the
            // sheet portals to <body> and would otherwise escape `hidden`.
            standby={!onHome}
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

const SERVICE_ICONS: Record<string, IconSvgElement> = {
  ride: Car01Icon,
  reserve: Calendar03Icon,
  courier: Package01Icon,
  assist: WheelchairIcon,
};

function serviceHref(id: string) {
  if (id === "courier") return "/?service=courier";
  if (id === "reserve") return "/?service=reserve";
  return "/";
}

function SignInLink({ className }: { className?: string }) {
  return (
    <Link
      href="/signin"
      className={cn(
        "focus-visible:ring-ring rounded-full px-3 py-1.5 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      Sign in
    </Link>
  );
}

/** Compact launcher for what LimeCab offers — same capsule language as the tabs. */
function ServiceRibbon() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("service");
  const activeId =
    pathname !== "/"
      ? null
      : current === "courier" || current === "reserve"
        ? current
        : "ride";

  return <ServiceRibbonList activeId={activeId} />;
}

function ServiceRibbonList({ activeId }: { activeId: string | null }) {
  return (
    <nav aria-label="Services" className="min-w-0 flex-1 md:flex-none">
      <ul className="bg-card/90 ring-border grid w-full grid-cols-4 items-center gap-0.5 rounded-full p-1 ring-1 md:flex md:w-auto">
        {LIMECAB_SERVICES.map((service) => {
          const icon = SERVICE_ICONS[service.id] ?? Car01Icon;
          const available = service.status === "available";
          const active = available && service.id === activeId;
          const className = cn(
            "flex min-h-11 w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-full px-1",
            "text-[10px] font-medium tracking-tight md:flex-row md:gap-1.5 md:px-3 md:text-[11px]",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
            active
              ? "bg-primary text-primary-foreground"
              : available
                ? "text-foreground hover:bg-accent"
                : "text-muted-foreground",
          );
          const body = (
            <>
              <Icon
                icon={icon}
                size={16}
                strokeWidth={active ? 2 : 1.5}
                aria-hidden="true"
              />
              <span className="truncate">{service.title}</span>
            </>
          );

          return (
            <li key={service.id} className="min-w-0 md:flex-none">
              {available ? (
                <Link
                  href={serviceHref(service.id)}
                  aria-current={active ? "page" : undefined}
                  className={className}
                >
                  {body}
                </Link>
              ) : (
                <span
                  className={className}
                  aria-disabled="true"
                  aria-label={`${service.title}. Not in your city yet`}
                  title="Not in your city yet"
                >
                  {body}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
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
    <div className="min-h-[calc(100dvh-var(--service-app-chrome,3.75rem))] px-5 pb-[var(--nav-pill-clear,8rem)] md:mx-auto md:max-w-2xl md:px-6">
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
