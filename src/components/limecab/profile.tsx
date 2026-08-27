import { type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Car01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

import { TabPageFrame } from "@/components/limecab/limecab-shell";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/** Up to two initials from a display name. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function TabSubpage({
  backHref,
  backLabel,
  title,
  children,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <TabPageFrame>
      <BackLink href={backHref} label={backLabel} />
      <h1 className="font-heading mt-3 text-[34px] leading-none font-bold tracking-[-0.035em]">
        {title}
      </h1>
      <div className="mt-7">{children}</div>
    </TabPageFrame>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="focus-visible:ring-ring -ml-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
    >
      <Icon icon={ArrowLeft01Icon} size={22} />
      <span className="sr-only">{label}</span>
    </Link>
  );
}

export function ProfileHero({
  name,
  facts,
  headingClassName,
}: {
  name: string;
  facts: { icon?: IconSvgElement; label: string; iconClassName?: string }[];
  headingClassName?: string;
}) {
  return (
    <div>
      <span
        aria-hidden="true"
        className="bg-accent text-accent-foreground flex size-20 items-center justify-center rounded-full text-[28px] font-semibold tracking-tight"
      >
        {initials(name)}
      </span>
      <h1
        className={cn(
          "font-heading mt-5 text-[34px] leading-none font-bold tracking-[-0.035em]",
          headingClassName,
        )}
      >
        {name}
      </h1>
      {facts.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {facts.map((fact) => (
            <Chip
              key={fact.label}
              icon={fact.icon}
              iconClassName={fact.iconClassName}
              label={fact.label}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Chip({
  icon,
  iconClassName,
  label,
}: {
  icon?: IconSvgElement;
  iconClassName?: string;
  label: string;
}) {
  return (
    <span className="bg-card ring-border flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium tracking-tight ring-1">
      {icon ? (
        <Icon
          icon={icon}
          size={14}
          className={cn("shrink-0", iconClassName)}
          aria-hidden="true"
        />
      ) : null}
      <span className="truncate tabular-nums">{label}</span>
    </span>
  );
}

export function ProfileSection({
  title,
  children,
  className,
  tone = "tab",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  tone?: "tab" | "driver";
}) {
  return (
    <section className={cn(tone === "driver" ? "mt-8" : "mt-7", className)}>
      {title ? (
        <h2
          className={
            tone === "driver"
              ? "text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase"
              : "text-[20px] font-semibold tracking-[-0.02em]"
          }
        >
          {title}
        </h2>
      ) : null}
      <div
        className={cn(
          "divide-border bg-card ring-border divide-y rounded-2xl ring-1",
          title && "mt-3",
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function DriverSubpage({
  backHref,
  backLabel,
  title,
  children,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <BackLink href={backHref} label={backLabel} />
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">
        {title}
      </h1>
      <div className="mt-6">{children}</div>
    </>
  );
}

export function ProfileLinkRow({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value?: string;
}) {
  return (
    <Link
      href={href}
      className="focus-visible:ring-ring active:bg-accent flex min-h-14 items-center gap-3 px-4 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
    >
      <span className="shrink-0 text-[15px] font-medium tracking-tight">
        {label}
      </span>
      {value ? (
        <span className="text-muted-foreground min-w-0 flex-1 truncate text-right text-sm tabular-nums">
          {value}
        </span>
      ) : (
        <span className="flex-1" />
      )}
      <Icon
        icon={ArrowRight01Icon}
        size={18}
        className="text-muted-foreground shrink-0"
        aria-hidden="true"
      />
    </Link>
  );
}

export function ProfileValueRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4">
      <span className="shrink-0 text-[15px] font-medium tracking-tight">
        {label}
      </span>
      <span className="text-muted-foreground min-w-0 flex-1 truncate text-right text-sm tabular-nums">
        {value}
      </span>
    </div>
  );
}

export function ProfileNote({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
      {children}
    </p>
  );
}

export function SignOutLink({ className }: { className?: string }) {
  return (
    // NextAuth's sign-out is a route handler, not a page: a real navigation.
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a
      href="/api/auth/signout"
      className={cn(
        "ring-border focus-visible:ring-ring active:bg-accent mt-7 flex min-h-14 items-center justify-center rounded-full text-[15px] font-semibold tracking-tight ring-1 focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      Sign out
    </a>
  );
}

export function VehicleCard({
  href,
  make,
  model,
  color,
  plate,
  year,
}: {
  href?: string;
  make: string;
  model: string;
  color: string;
  plate: string;
  year?: string;
}) {
  const title = year ? `${year} ${make} ${model}` : `${make} ${model}`;
  const body = (
    <>
      <span
        aria-hidden="true"
        className="bg-muted flex size-16 shrink-0 items-center justify-center rounded-xl"
      >
        <Icon icon={Car01Icon} size={28} className="text-muted-foreground" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium tracking-tight">
          {title}
        </p>
        <p className="text-muted-foreground mt-0.5 truncate text-sm">{color}</p>
        <p className="mt-1 text-sm font-medium tracking-tight tabular-nums">
          {plate}
        </p>
      </div>
      {href ? (
        <Icon
          icon={ArrowRight01Icon}
          size={20}
          className="text-muted-foreground shrink-0"
          aria-hidden="true"
        />
      ) : null}
    </>
  );

  const shell =
    "bg-card ring-border flex items-center gap-3 rounded-2xl p-3 ring-1";

  if (!href) {
    return <div className={shell}>{body}</div>;
  }

  return (
    <Link
      href={href}
      className={cn(
        shell,
        "focus-visible:ring-ring active:bg-accent focus-visible:ring-2 focus-visible:outline-none",
      )}
    >
      {body}
    </Link>
  );
}
