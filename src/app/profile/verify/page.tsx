import { redirect } from "next/navigation";

import { VerifySettings } from "@/components/limecab/verify-settings";
import { ProfileNote, TabSubpage } from "@/components/limecab/profile";
import { auth } from "@/server/auth";

export default async function VerifyPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin?callbackUrl=/profile/verify");

  return (
    <TabSubpage
      backHref="/profile"
      backLabel="Back to profile"
      title="Verification"
    >
      <VerifySettings />
      <ProfileNote>
        Rides are not blocked while this is open. Phone and ID just make it
        easier to reach you and to sort out a trip later.
      </ProfileNote>
    </TabSubpage>
  );
}
