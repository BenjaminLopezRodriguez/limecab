import { redirect } from "next/navigation";

import { SettingSwitch } from "@/components/limecab/profile-settings";
import {
  DriverSubpage,
  ProfileNote,
  ProfileSection,
  ProfileValueRow,
} from "@/components/limecab/profile";
import { auth } from "@/server/auth";
import { api } from "@/trpc/server";

export default async function DriverSafetyPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const { driver } = await api.driver.me();
  if (!driver) redirect("/driver/profile");

  return (
    <DriverSubpage
      backHref="/driver/profile"
      backLabel="Back to profile"
      title="Safety"
    >
      <ProfileSection tone="driver" title="On a job">
        <ProfileValueRow label="Pickup PIN" value="Read it back at the curb" />
        <SettingSwitch
          label="Share my live location with LimeCab"
          description="Used to show riders where you are. Required while a trip is active."
          defaultChecked
        />
      </ProfileSection>

      <ProfileSection tone="driver" title="Help">
        <ProfileValueRow label="Emergency" value="Call 911" />
        <a
          href="mailto:safety@limecab.app"
          className="focus-visible:ring-ring active:bg-accent flex min-h-14 items-center justify-between gap-3 px-4 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
        >
          <span className="text-[15px] font-medium tracking-tight">
            Report a safety issue
          </span>
          <span className="text-muted-foreground truncate text-sm">
            safety@limecab.app
          </span>
        </a>
      </ProfileSection>

      <ProfileNote>
        The PIN is the rider’s. Matching it at pickup is how both of you know
        you’re in the right car.
      </ProfileNote>
    </DriverSubpage>
  );
}
