import {
  Car01Icon,
  Location01Icon,
  Package01Icon,
  ShoppingBasket01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { TabPage } from "@/components/limecab/limecab-shell";
import { Icon } from "@/components/ui/icon";
import { findBookableProduct, isCourierProduct } from "@/lib/limecab/courier";
import { formatTripWhen, tripStatusLabel } from "@/lib/limecab/format";
import { RIDE_PRODUCTS } from "@/lib/limecab/mock";
import {
  isShopTrip,
  parseShopList,
  shopItemCountLabel,
  shopListSummary,
  shopListUnitCount,
} from "@/lib/limecab/shop-list";
import { formatMoney, splitAddress } from "@/lib/service-app/services";
import { cn } from "@/lib/utils";
import { auth } from "@/server/auth";
import { api } from "@/trpc/server";

type ActivityTab = "trips" | "shop";

function productName(id: string): string {
  return findBookableProduct(id, RIDE_PRODUCTS)?.name ?? "Lime";
}

function resolveTab(raw: string | string[] | undefined): ActivityTab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "shop" ? "shop" : "trips";
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin?callbackUrl=/activity");

  const params = await searchParams;
  const tab = resolveTab(params.tab);
  const trips = await api.trip.list();
  const carts = trips.filter((trip) => isShopTrip(trip.itemList));
  const tripRows = trips.filter((trip) => !isShopTrip(trip.itemList));

  return (
    <TabPage title="Activity">
      <ActivityTabs active={tab} />

      {tab === "shop" ? (
        <ShopCartsSection carts={carts} />
      ) : (
        <TripsSection trips={tripRows} />
      )}
    </TabPage>
  );
}

function ActivityTabs({ active }: { active: ActivityTab }) {
  const tabs: { id: ActivityTab; label: string; href: string }[] = [
    { id: "trips", label: "Trips", href: "/activity" },
    { id: "shop", label: "Shop", href: "/activity?tab=shop" },
  ];

  return (
    <nav aria-label="Activity" className="-mt-1 mb-7">
      <ul className="flex gap-2 overflow-x-auto pb-0.5">
        {tabs.map((entry) => {
          const selected = entry.id === active;
          return (
            <li key={entry.id}>
              <Link
                href={entry.href}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium tracking-tight focus-visible:ring-2 focus-visible:outline-none",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "ring-border text-muted-foreground hover:text-foreground ring-1",
                )}
              >
                {entry.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function TripsSection({
  trips,
}: {
  trips: Awaited<ReturnType<typeof api.trip.list>>;
}) {
  return (
    <>
      <section>
        <h2 className="text-[20px] font-semibold tracking-[-0.02em]">
          Upcoming
        </h2>
        {/* No scheduling in this build, so this state is the whole section —
            and it points at the one thing that does work, the ride flow. */}
        <div className="ring-border mt-3 rounded-2xl px-5 py-6 ring-1">
          <p className="text-[15px] font-semibold tracking-tight">
            You have no upcoming trips
          </p>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Booking ahead isn&apos;t live yet. Rides you take now show up under
            Past.
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[20px] font-semibold tracking-[-0.02em]">Past</h2>
        {trips.length === 0 ? (
          <EmptyState
            title="No trips yet"
            body="Your rides show up here once you take one."
          />
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {trips.map((trip) => {
              const courier = isCourierProduct(trip.productId);
              return (
                <ActivityRow
                  key={trip.id}
                  href={`/activity/${trip.id}`}
                  rebookHref={courier ? "/?service=courier" : "/"}
                  icon={courier ? Package01Icon : Car01Icon}
                  title={
                    courier && trip.recipientName
                      ? trip.recipientName
                      : trip.destinationAddress
                  }
                  meta={`${formatTripWhen(trip.requestedAt)} · ${productName(trip.productId)} · ${tripStatusLabel(trip.status, courier)}`}
                  amount={formatMoney(trip.totalCents)}
                />
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function ShopCartsSection({
  carts,
}: {
  carts: Awaited<ReturnType<typeof api.trip.list>>;
}) {
  return (
    <section>
      <h2 className="text-[20px] font-semibold tracking-[-0.02em]">Carts</h2>
      {carts.length === 0 ? (
        <EmptyState
          title="No carts yet"
          body="Shop lists you order show up here. Draft lists stay on Home until you request."
          ctaHref="/?service=shop"
          ctaLabel="Start a shop"
        />
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {carts.map((trip) => {
            const items = parseShopList(trip.itemList);
            const summary = shopListSummary(items);
            const store = splitAddress(trip.pickupAddress).line;
            const count = shopItemCountLabel(shopListUnitCount(items));
            return (
              <ActivityRow
                key={trip.id}
                href={`/activity/${trip.id}`}
                rebookHref="/?service=shop"
                rebookLabel="Reorder"
                icon={ShoppingBasket01Icon}
                title={summary || store}
                meta={`${formatTripWhen(trip.requestedAt)} · ${store} · ${count} · ${tripStatusLabel(trip.status, true)}`}
                amount={formatMoney(trip.totalCents)}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}

function EmptyState({
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="ring-border mt-3 flex flex-col items-center rounded-2xl px-5 py-12 text-center ring-1">
      <p className="text-[15px] font-medium tracking-tight">{title}</p>
      <p className="text-muted-foreground mt-2 max-w-xs text-sm leading-relaxed">
        {body}
      </p>
      {ctaHref && ctaLabel ? (
        <Link
          href={ctaHref}
          className="ring-border focus-visible:ring-ring active:bg-accent mt-5 flex min-h-11 items-center rounded-full px-4 text-sm font-medium tracking-tight ring-1 focus-visible:ring-2 focus-visible:outline-none"
        >
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}

function ActivityRow({
  href,
  rebookHref,
  rebookLabel = "Rebook",
  icon,
  title,
  meta,
  amount,
}: {
  href: string;
  rebookHref: string;
  rebookLabel?: string;
  icon: IconSvgElement;
  title: string;
  meta: string;
  amount: string;
}) {
  return (
    <li className="bg-card ring-border flex items-center gap-3 rounded-2xl ring-1">
      <Link
        href={href}
        className="focus-visible:ring-ring active:bg-accent flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-3 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
      >
        <span
          aria-hidden="true"
          className="bg-muted relative flex size-16 shrink-0 items-center justify-center rounded-xl"
        >
          <Icon icon={icon} size={28} className="text-muted-foreground" />
          <Icon
            icon={Location01Icon}
            size={14}
            className="text-foreground absolute right-1.5 bottom-1.5"
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium tracking-tight">
            {title}
          </p>
          <p className="text-muted-foreground truncate text-sm tabular-nums">
            {meta}
          </p>
          <p className="text-muted-foreground text-sm tabular-nums">{amount}</p>
        </div>
      </Link>
      <Link
        href={rebookHref}
        className="ring-border focus-visible:ring-ring active:bg-accent mr-3 flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium tracking-tight ring-1 focus-visible:ring-2 focus-visible:outline-none"
      >
        {rebookLabel}
      </Link>
    </li>
  );
}
