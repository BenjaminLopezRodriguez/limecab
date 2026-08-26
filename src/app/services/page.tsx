import { type ComponentType } from "react";
import Link from "next/link";
import { Accessibility, CalendarClock, CarFront, Package } from "lucide-react";

import { TabPage } from "@/components/limecab/limecab-shell";
import { LIMECAB_SERVICES } from "@/lib/limecab/mock";
import { cn } from "@/lib/utils";

type Icon = ComponentType<{ className?: string; strokeWidth?: number }>;

const ICONS: Record<string, Icon> = {
  ride: CarFront,
  reserve: CalendarClock,
  courier: Package,
  assist: Accessibility,
};

export default function ServicesPage() {
  // Two lead tiles, then the rest smaller: the reference's mixed grid.
  const featured = LIMECAB_SERVICES.slice(0, 2);
  const others = LIMECAB_SERVICES.slice(2);

  return (
    <TabPage title="Services">
      <h2 className="text-[20px] font-semibold tracking-[-0.02em]">
        Go anywhere
      </h2>

      <div className="mt-3 grid grid-cols-2 gap-3">
        {featured.map((service) => (
          <Tile key={service.id} service={service} className="h-[7rem]" />
        ))}
      </div>

      {others.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {others.map((service) => (
            <Tile key={service.id} service={service} className="h-[5.5rem]" />
          ))}
        </div>
      ) : null}

      <p className="text-muted-foreground mt-5 text-sm leading-relaxed">
        Only rides are live. The rest are listed so you can see where LimeCab is
        going, not to take your booking.
      </p>
    </TabPage>
  );
}

/**
 * An unavailable service is a card, not a button: it says why it can't be
 * picked instead of pretending to be pickable.
 */
function Tile({
  service,
  className,
}: {
  service: (typeof LIMECAB_SERVICES)[number];
  className?: string;
}) {
  const Icon = ICONS[service.id] ?? CarFront;
  const body = (
    <>
      <span
        aria-hidden="true"
        className="bg-muted flex size-10 items-center justify-center rounded-xl"
      >
        <Icon className="text-foreground size-5" strokeWidth={1.7} />
      </span>
      <span className="mt-auto">
        <span className="block text-[15px] font-medium tracking-tight">
          {service.title}
        </span>
        <span className="text-muted-foreground block text-xs">
          {service.status === "available"
            ? service.description
            : "Not in your city yet"}
        </span>
      </span>
    </>
  );

  const shell = cn(
    "bg-card ring-border flex flex-col items-start rounded-2xl p-3.5 ring-1",
    className,
  );

  if (service.status !== "available") {
    return (
      <div className={shell} aria-disabled="true">
        {body}
      </div>
    );
  }

  return (
    <Link
      href="/"
      className={cn(
        shell,
        "focus-visible:ring-ring active:bg-accent focus-visible:ring-2 focus-visible:outline-none",
      )}
    >
      {body}
    </Link>
  );
}
