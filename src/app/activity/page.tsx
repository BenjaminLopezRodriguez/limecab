import { Car01Icon, Location01Icon, Package01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { redirect } from "next/navigation";

import { TabPage } from "@/components/limecab/limecab-shell";
import { Icon } from "@/components/ui/icon";
import { findBookableProduct, isCourierProduct } from "@/lib/limecab/courier";
import { formatTripWhen, tripStatusLabel } from "@/lib/limecab/format";
import { RIDE_PRODUCTS } from "@/lib/limecab/mock";
import { formatMoney } from "@/lib/service-app/services";
import { auth } from "@/server/auth";
import { api } from "@/trpc/server";

function productName(id: string): string {
  return findBookableProduct(id, RIDE_PRODUCTS)?.name ?? "Lime";
}

export default async function ActivityPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin?callbackUrl=/activity");

  const trips = await api.trip.list();

  return (
    <TabPage title="Activity">
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
          <div className="ring-border mt-3 flex flex-col items-center rounded-2xl px-5 py-12 text-center ring-1">
            <p className="text-[15px] font-medium tracking-tight">
              No trips yet
            </p>
            <p className="text-muted-foreground mt-2 max-w-xs text-sm leading-relaxed">
              Your rides show up here once you take one.
            </p>
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {trips.map((trip) => {
              const courier = isCourierProduct(trip.productId);
              return (
              <li
                key={trip.id}
                className="bg-card ring-border flex items-center gap-3 rounded-2xl ring-1"
              >
                <Link
                  href={`/activity/${trip.id}`}
                  className="focus-visible:ring-ring active:bg-accent flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-3 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
                >
                  <span
                    aria-hidden="true"
                    className="bg-muted relative flex size-16 shrink-0 items-center justify-center rounded-xl"
                  >
                    <Icon
                      icon={courier ? Package01Icon : Car01Icon}
                      size={28}
                      className="text-muted-foreground"
                    />
                    <Icon
                      icon={Location01Icon}
                      size={14}
                      className="text-foreground absolute right-1.5 bottom-1.5"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium tracking-tight">
                      {courier && trip.recipientName
                        ? trip.recipientName
                        : trip.destinationAddress}
                    </p>
                    <p className="text-muted-foreground truncate text-sm tabular-nums">
                      {formatTripWhen(trip.requestedAt)} · {productName(trip.productId)}
                      {" · "}
                      {tripStatusLabel(trip.status, courier)}
                    </p>
                    <p className="text-muted-foreground text-sm tabular-nums">
                      {formatMoney(trip.totalCents)}
                    </p>
                  </div>
                </Link>
                <Link
                  href={courier ? "/?service=courier" : "/"}
                  className="ring-border focus-visible:ring-ring active:bg-accent mr-3 flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium tracking-tight ring-1 focus-visible:ring-2 focus-visible:outline-none"
                >
                  Rebook
                </Link>
              </li>
              );
            })}
          </ul>
        )}
      </section>
    </TabPage>
  );
}
