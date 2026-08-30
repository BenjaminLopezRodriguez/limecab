import { notFound, redirect } from "next/navigation";

import { DriverEarningsTripDetail } from "@/components/limecab/driver-earnings-trip-detail";
import { DriverSubpage } from "@/components/limecab/profile";
import { auth } from "@/server/auth";
import { api } from "@/trpc/server";

export default async function DriverEarningsTripPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const { driver } = await api.driver.me();
  if (!driver) redirect("/driver/profile");

  const { tripId } = await params;
  let trip;
  try {
    trip = await api.driver.get({ tripId });
  } catch {
    notFound();
  }

  if (trip.status !== "complete") notFound();

  return (
    <DriverSubpage
      backHref="/driver/profile/earnings"
      backLabel="Back to earnings"
      title="Trip"
    >
      <DriverEarningsTripDetail trip={trip} />
    </DriverSubpage>
  );
}
