import { redirect } from "next/navigation";

import { SettingSwitch } from "@/components/limecab/profile-settings";
import {
  DriverSubpage,
  ProfileNote,
  ProfileSection,
} from "@/components/limecab/profile";
import { DRIVER_PREFERENCES } from "@/lib/limecab/mock";
import { auth } from "@/server/auth";
import { api } from "@/trpc/server";

export default async function DriverPreferencesPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const { driver } = await api.driver.me();
  if (!driver) redirect("/driver/profile");

  return (
    <DriverSubpage
      backHref="/driver/profile"
      backLabel="Back to profile"
      title="Driving preferences"
    >
      <ProfileSection tone="driver">
        <SettingSwitch
          label="Navigation voice"
          description="Spoken turn-by-turn while a job is active."
          defaultChecked={DRIVER_PREFERENCES.navigationVoice}
        />
        <SettingSwitch
          label="Lime XL"
          description="Offers for six-seaters when your car qualifies."
          defaultChecked={DRIVER_PREFERENCES.acceptXl}
        />
        <SettingSwitch
          label="Longer trips"
          description="Airport and out-of-area jobs, not just neighborhood hops."
          defaultChecked={DRIVER_PREFERENCES.longTrips}
        />
        <SettingSwitch
          label="Courier jobs"
          description="Same-day packages on the same inbox as rides."
          defaultChecked={DRIVER_PREFERENCES.courierJobs}
        />
      </ProfileSection>
      <ProfileNote>
        Going offline from the inbox still pauses everything. These only shape
        which offers you’re shown while you’re on duty.
      </ProfileNote>
    </DriverSubpage>
  );
}
