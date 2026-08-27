import { redirect } from "next/navigation";

import {
  DriverSubpage,
  ProfileNote,
  ProfileSection,
  ProfileValueRow,
} from "@/components/limecab/profile";
import { DRIVER_DOCUMENTS } from "@/lib/limecab/mock";
import { auth } from "@/server/auth";
import { api } from "@/trpc/server";

export default async function DriverDocumentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const { driver } = await api.driver.me();
  if (!driver) redirect("/driver/profile");

  return (
    <DriverSubpage
      backHref="/driver/profile"
      backLabel="Back to profile"
      title="Documents"
    >
      <ProfileSection tone="driver">
        {DRIVER_DOCUMENTS.map((doc) => (
          <ProfileValueRow
            key={doc.id}
            label={doc.label}
            value={`${doc.status} · ${doc.detail}`}
          />
        ))}
      </ProfileSection>
      <ProfileNote>
        Verification status for this account. Uploading replacements isn&apos;t
        in this build.
      </ProfileNote>
    </DriverSubpage>
  );
}
