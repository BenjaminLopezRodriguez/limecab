import { notFound, redirect } from "next/navigation";

import { SupportForm } from "@/components/limecab/support-form";
import { ProfileNote, TabSubpage } from "@/components/limecab/profile";
import { isSupportTopic, SUPPORT_TOPICS } from "@/lib/limecab/support";
import { auth } from "@/server/auth";
import { api } from "@/trpc/server";

export default async function TripHelpTopicPage({
  params,
}: {
  params: Promise<{ tripId: string; topic: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin?callbackUrl=/activity");

  const { tripId, topic } = await params;
  if (!isSupportTopic(topic)) notFound();

  try {
    await api.trip.get({ id: tripId });
  } catch {
    notFound();
  }

  const copy = SUPPORT_TOPICS[topic];

  return (
    <TabSubpage
      backHref={`/activity/${tripId}/help`}
      backLabel="Back to help"
      title={copy.title}
    >
      <p className="text-muted-foreground -mt-4 mb-6 text-sm leading-relaxed">
        {copy.hint}
      </p>
      <SupportForm tripId={tripId} topic={topic} />
      <ProfileNote>
        This note stays on the trip. There is no live agent inbox in this build.
      </ProfileNote>
    </TabSubpage>
  );
}
