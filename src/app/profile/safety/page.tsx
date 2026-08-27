import { redirect } from "next/navigation";

import { SettingSwitch } from "@/components/limecab/profile-settings";
import {
  ProfileNote,
  ProfileSection,
  ProfileValueRow,
  TabSubpage,
} from "@/components/limecab/profile";
import { RIDER_SAFETY } from "@/lib/limecab/mock";
import { auth } from "@/server/auth";

export default async function SafetyPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  return (
    <TabSubpage
      backHref="/profile"
      backLabel="Back to profile"
      title="Safety & privacy"
    >
      <ProfileSection title="During a ride">
        <ProfileValueRow
          label="Pickup PIN"
          value={RIDER_SAFETY.pickupPin ? "On every ride" : "Off"}
        />
        <SettingSwitch
          label="Share trip"
          description="Send a live link to someone you trust while you’re on the way."
          defaultChecked={RIDER_SAFETY.shareTrip}
        />
      </ProfileSection>

      <ProfileSection title="People">
        <ProfileValueRow
          label="Trusted contact"
          value={RIDER_SAFETY.trustedContact}
        />
      </ProfileSection>

      <ProfileSection title="Privacy">
        <SettingSwitch
          label="Use my location to find pickup"
          description="Needed to put the pin on the map. We don’t sell it."
          defaultChecked
        />
      </ProfileSection>

      <ProfileNote>
        The PIN is generated when a driver is assigned. Read it back at the curb
        so you’re in the right car.
      </ProfileNote>
    </TabSubpage>
  );
}
