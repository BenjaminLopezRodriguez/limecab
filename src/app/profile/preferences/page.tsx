import { redirect } from "next/navigation";

import { SettingSwitch } from "@/components/limecab/profile-settings";
import {
  ProfileNote,
  ProfileSection,
  ProfileValueRow,
  TabSubpage,
} from "@/components/limecab/profile";
import { RIDER_PREFERENCES } from "@/lib/limecab/mock";
import { auth } from "@/server/auth";

export default async function RidePreferencesPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  return (
    <TabSubpage
      backHref="/profile"
      backLabel="Back to profile"
      title="Ride preferences"
    >
      <ProfileSection>
        <ProfileValueRow
          label="Default ride"
          value={RIDER_PREFERENCES.defaultProductName}
        />
        <SettingSwitch
          label="Quiet ride"
          description="Drivers get a note to keep conversation light."
          defaultChecked={RIDER_PREFERENCES.quietRide}
        />
        <SettingSwitch
          label="Wait at pickup"
          description="Give you a couple of extra minutes at the curb."
          defaultChecked={RIDER_PREFERENCES.waitOnArrival}
        />
        <SettingSwitch
          label="Extra stops"
          description="Offer a stop when you book, when the product allows it."
          defaultChecked={RIDER_PREFERENCES.extraStops}
        />
      </ProfileSection>
      <ProfileNote>
        Default ride is Lime. You still pick XL, Comfort, or Wait & Save each
        time you book.
      </ProfileNote>
    </TabSubpage>
  );
}
