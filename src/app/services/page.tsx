import {
  Calendar03Icon,
  Car01Icon,
  Package01Icon,
  WheelchairIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import Link from "next/link";

import { TabPage } from "@/components/limecab/limecab-shell";
import { Icon } from "@/components/ui/icon";
import { LIMECAB_SERVICES } from "@/lib/limecab/mock";
import { cn } from "@/lib/utils";

const ICONS: Record<string, IconSvgElement> = {
  ride: Car01Icon,
  reserve: Calendar03Icon,
  courier: Package01Icon,
  assist: WheelchairIcon,
};

export default function ServicesPage() {
  const live = LIMECAB_SERVICES.filter(
    (service) => service.status === "available",
  );
  const soon = LIMECAB_SERVICES.filter(
    (service) => service.status !== "available",
  );

  return (
    <TabPage title="Services">
      <h2 className="text-[20px] font-semibold tracking-[-0.02em]">
        Go anywhere
      </h2>

      <div className="mt-3 grid grid-cols-2 gap-3">
        {live.map((service) => (
          <Tile key={service.id} service={service} className="h-[7rem]" />
        ))}
      </div>

      {soon.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {soon.map((service) => (
            <Tile key={service.id} service={service} className="h-[5.5rem]" />
          ))}
        </div>
      ) : null}

      <p className="text-muted-foreground mt-5 text-sm leading-relaxed">
        Rides and Courier are live. Reserve and Assist are listed so you can see
        where LimeCab is going, not to take your booking.
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
  const icon = ICONS[service.id] ?? Car01Icon;
  const body = (
    <>
      <span
        aria-hidden="true"
        className="bg-muted flex size-10 items-center justify-center rounded-full"
      >
        <Icon icon={icon} size={20} className="text-foreground" />
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

  const href = service.id === "courier" ? "/?service=courier" : "/";

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
