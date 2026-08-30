import {
  Calendar03Icon,
  Car01Icon,
  CarParking01Icon,
  DeliveryTruck01Icon,
  Home01Icon,
  MeetingRoomIcon,
  Package01Icon,
  ShoppingBasket01Icon,
  SparklesIcon,
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
  shop: ShoppingBasket01Icon,
  help: Home01Icon,
  assist: SparklesIcon,
  freight: DeliveryTruck01Icon,
  spaces: MeetingRoomIcon,
  station: CarParking01Icon,
};

export default function ServicesPage() {
  return (
    <TabPage title="Services">
      <div className="grid grid-cols-2 gap-3">
        {LIMECAB_SERVICES.map((service) => (
          <Tile
            key={service.id}
            service={service}
            className={
              service.status === "available" ? "h-[7rem]" : "h-[5.5rem]"
            }
          />
        ))}
      </div>

      <p className="text-muted-foreground mt-5 text-sm leading-relaxed">
        Rides, Courier, Reserve, Shop, Help, and Assist are live. Spaces and
        Station are next — rooms, venues, and parking in the same flow as a
        ride. Assist is the launcher — say what you want, and LimeCab stages
        the ride, shop, send, or help quote. You always confirm before anything
        is requested.{" "}
        <Link
          href="/partner"
          className="text-foreground font-medium underline-offset-2 hover:underline"
        >
          Partner with Lime
        </Link>{" "}
        for fleets, freight, and merchants.
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

  const href =
    service.id === "courier"
      ? "/?service=courier"
      : service.id === "reserve"
        ? "/?service=reserve"
        : service.id === "shop"
          ? "/?service=shop"
          : service.id === "help"
            ? "/?service=help"
            : service.id === "assist"
              ? "/?service=assist"
              : service.id === "freight"
                ? "/freight"
                : service.id === "spaces"
                  ? "/?service=spaces"
                  : service.id === "station"
                    ? "/?service=station"
                    : "/";

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
