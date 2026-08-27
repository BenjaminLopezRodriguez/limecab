import { redirect } from "next/navigation";

import {
  ProfileNote,
  ProfileSection,
  ProfileValueRow,
  TabSubpage,
} from "@/components/limecab/profile";
import { SAVED_PLACES } from "@/lib/limecab/mock";
import { auth } from "@/server/auth";

export default async function SavedPlacesPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const saved = SAVED_PLACES.filter((place) => place.source === "saved");

  return (
    <TabSubpage
      backHref="/profile"
      backLabel="Back to profile"
      title="Saved places"
    >
      <ProfileSection>
        {saved.map((place) => (
          <ProfileValueRow
            key={place.id}
            label={place.label}
            value={place.address}
          />
        ))}
      </ProfileSection>
      <ProfileNote>
        Home and Work fill in pickup and destination the moment you tap them on
        the map.
      </ProfileNote>
    </TabSubpage>
  );
}
