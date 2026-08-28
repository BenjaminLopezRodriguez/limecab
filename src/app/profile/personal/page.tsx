import { redirect } from "next/navigation";

import {
  ProfileNote,
  ProfileSection,
  ProfileValueRow,
  TabSubpage,
} from "@/components/limecab/profile";
import { auth } from "@/server/auth";
import { api } from "@/trpc/server";

export default async function PersonalInfoPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const rider = await api.rider.me();
  const name = session.user.name ?? "Not on file";
  const email = session.user.email ?? "Not on file";

  return (
    <TabSubpage
      backHref="/profile"
      backLabel="Back to profile"
      title="Personal info"
    >
      <ProfileSection>
        <ProfileValueRow label="Name" value={name} />
        <ProfileValueRow label="Phone" value={rider.phone ?? "Not on file"} />
        <ProfileValueRow label="Email" value={email} />
      </ProfileSection>
      <ProfileNote>
        Name and email come from your sign-in. Phone is the number drivers see
        at pickup.
      </ProfileNote>
    </TabSubpage>
  );
}
