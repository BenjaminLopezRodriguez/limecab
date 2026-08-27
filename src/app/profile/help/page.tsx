import { redirect } from "next/navigation";

import {
  ProfileLinkRow,
  ProfileNote,
  ProfileSection,
  ProfileValueRow,
  TabSubpage,
} from "@/components/limecab/profile";
import { auth } from "@/server/auth";

export default async function HelpPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  return (
    <TabSubpage backHref="/profile" backLabel="Back to profile" title="Help">
      <ProfileSection title="Trips">
        <ProfileValueRow
          label="A fare looks wrong"
          value="Activity → that trip"
        />
        <ProfileValueRow
          label="I left something in the car"
          value="Activity → that trip"
        />
        <ProfileLinkRow href="/activity" label="Open Activity" />
        <ProfileValueRow
          label="I need to cancel"
          value="From the live ride screen"
        />
      </ProfileSection>

      <ProfileSection title="Safety">
        <ProfileValueRow label="Emergency" value="Call 911, then use Safety" />
        <ProfileLinkRow href="/profile/safety" label="Safety & privacy" />
      </ProfileSection>

      <ProfileSection title="LimeCab">
        <ProfileValueRow label="How rides work" value="Book from Home" />
        <a
          href="mailto:support@limecab.app"
          className="focus-visible:ring-ring active:bg-accent flex min-h-14 items-center justify-between gap-3 px-4 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
        >
          <span className="text-[15px] font-medium tracking-tight">
            Email support
          </span>
          <span className="text-muted-foreground truncate text-sm">
            support@limecab.app
          </span>
        </a>
      </ProfileSection>

      <ProfileNote>
        Lost items and fare questions start from the trip they belong to, not a
        general inbox.
      </ProfileNote>
    </TabSubpage>
  );
}
