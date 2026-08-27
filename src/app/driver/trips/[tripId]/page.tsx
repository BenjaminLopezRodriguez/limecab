import { redirect } from "next/navigation";

/**
 * The live job used to be its own document. It is now a scene of the duty
 * session at `/driver`, which hydrates into the right scene from the trip's
 * own status — so an old link (or a bookmark) lands on the job itself rather
 * than on a second, divergent UI of it.
 */
export default async function DriverTripPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  await params;
  redirect("/driver");
}
