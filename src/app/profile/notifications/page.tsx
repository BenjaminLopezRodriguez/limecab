import { redirect } from "next/navigation";

import { SettingSwitch } from "@/components/limecab/profile-settings";
import {
  ProfileNote,
  ProfileSection,
  TabSubpage,
} from "@/components/limecab/profile";
import { RIDER_NOTIFICATIONS } from "@/lib/limecab/mock";
import { auth } from "@/server/auth";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  return (
    <TabSubpage
      backHref="/profile"
      backLabel="Back to profile"
      title="Notifications"
    >
      <ProfileSection title="Trips">
        <SettingSwitch
          label="Trip updates"
          description="Assigned, arriving, and complete."
          defaultChecked={RIDER_NOTIFICATIONS.tripUpdates}
        />
        <SettingSwitch
          label="Driver messages"
          description="When your driver needs to reach you."
          defaultChecked={RIDER_NOTIFICATIONS.driverMessages}
        />
      </ProfileSection>

      <ProfileSection title="Account">
        <SettingSwitch
          label="Email receipts"
          description="A fare summary after each completed ride."
          defaultChecked={RIDER_NOTIFICATIONS.emailReceipts}
        />
        <SettingSwitch
          label="Promotions"
          description="Credits and seasonal offers. Off unless you turn it on."
          defaultChecked={RIDER_NOTIFICATIONS.promotions}
        />
      </ProfileSection>

      <ProfileNote>
        Trip updates are how you know a car is actually coming. Everything else
        can wait.
      </ProfileNote>
    </TabSubpage>
  );
}
