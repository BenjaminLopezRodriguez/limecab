import { redirect } from "next/navigation";

import { DriverPreferences } from "@/components/limecab/driver-preferences";
import { DriverSubpage } from "@/components/limecab/profile";
import { auth } from "@/server/auth";
import { api } from "@/trpc/server";

export default async function DriverPreferencesPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const { driver } = await api.driver.me();
  if (!driver) redirect("/driver/profile");

  // The heading target is chosen from the driver's own saved places — they
  // are a `users` row like anyone else.
  const saved = await api.places.list();
  const places = [saved.home, saved.work, ...saved.custom].flatMap((place) =>
    place ? [place] : [],
  );

  return (
    <DriverSubpage
      backHref="/driver/profile"
      backLabel="Back to profile"
      title="Preferences"
    >
      <DriverPreferences driver={driver} places={places} />
    </DriverSubpage>
  );
}
