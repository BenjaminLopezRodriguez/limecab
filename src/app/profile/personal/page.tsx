import { redirect } from "next/navigation";

import {
  ProfileNote,
  ProfileSection,
  ProfileValueRow,
  TabSubpage,
} from "@/components/limecab/profile";
import { RIDER } from "@/lib/limecab/mock";
import { auth } from "@/server/auth";

export default async function PersonalInfoPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const name = session.user.name ?? RIDER.fullName;
  const email = session.user.email ?? "Not on file";

  return (
    <TabSubpage
      backHref="/profile"
      backLabel="Back to profile"
      title="Personal info"
    >
      <ProfileSection>
        <ProfileValueRow label="Name" value={name} />
        <ProfileValueRow label="Phone" value={RIDER.phone} />
        <ProfileValueRow label="Email" value={email} />
      </ProfileSection>
      <ProfileNote>
        Name and email come from your sign-in. Phone is the number drivers see
        at pickup.
      </ProfileNote>
    </TabSubpage>
  );
}
