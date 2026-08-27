import { notFound, redirect } from "next/navigation";

import {
  ProfileLinkRow,
  ProfileNote,
  ProfileSection,
  TabSubpage,
} from "@/components/limecab/profile";
import { SUPPORT_TOPICS } from "@/lib/limecab/support";
import { auth } from "@/server/auth";
import { api } from "@/trpc/server";

export default async function TripHelpPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin?callbackUrl=/activity");

  const { tripId } = await params;
  try {
    await api.trip.get({ id: tripId });
  } catch {
    notFound();
  }

  return (
    <TabSubpage
      backHref={`/activity/${tripId}`}
      backLabel="Back to trip"
      title="Help with this trip"
    >
      <ProfileSection>
        {(Object.keys(SUPPORT_TOPICS) as (keyof typeof SUPPORT_TOPICS)[]).map(
          (topic) => (
            <ProfileLinkRow
              key={topic}
              href={`/activity/${tripId}/help/${topic}`}
              label={SUPPORT_TOPICS[topic].title}
            />
          ),
        )}
      </ProfileSection>
      <ProfileNote>
        Pick the reason that matches this ride. Emergency: call 911, then use
        Safety in Profile.
      </ProfileNote>
    </TabSubpage>
  );
}
