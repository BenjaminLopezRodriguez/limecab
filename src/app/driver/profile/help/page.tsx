import { redirect } from "next/navigation";

import {
  DriverSubpage,
  ProfileLinkRow,
  ProfileNote,
  ProfileSection,
  ProfileValueRow,
} from "@/components/limecab/profile";
import { auth } from "@/server/auth";
import { api } from "@/trpc/server";

export default async function DriverHelpPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const { driver } = await api.driver.me();
  if (!driver) redirect("/driver/profile");

  return (
    <DriverSubpage
      backHref="/driver/profile"
      backLabel="Back to profile"
      title="Help"
    >
      <ProfileSection tone="driver" title="Jobs">
        <ProfileValueRow
          label="A rider isn’t at pickup"
          value="Wait, then call from the job"
        />
        <ProfileValueRow
          label="I need to cancel"
          value="From the active job screen"
        />
        <ProfileLinkRow
          href="/driver/profile/earnings"
          label="Payout questions"
        />
      </ProfileSection>

      <ProfileSection tone="driver" title="Account">
        <ProfileLinkRow
          href="/driver/profile/documents"
          label="Documents & verification"
        />
        <a
          href="mailto:drivers@limecab.app"
          className="focus-visible:ring-ring active:bg-accent flex min-h-14 items-center justify-between gap-3 px-4 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
        >
          <span className="text-[15px] font-medium tracking-tight">
            Email driver support
          </span>
          <span className="text-muted-foreground truncate text-sm">
            drivers@limecab.app
          </span>
        </a>
      </ProfileSection>

      <ProfileNote>
        Job-specific problems start on that job, not here. This page is for
        account and payout questions.
      </ProfileNote>
    </DriverSubpage>
  );
}
