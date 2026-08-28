import { redirect } from "next/navigation";

import { TabSubpage } from "@/components/limecab/profile";
import { SavedPlacesEditor } from "@/components/limecab/saved-places-editor";
import { auth } from "@/server/auth";

export default async function SavedPlacesPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  return (
    <TabSubpage
      backHref="/profile"
      backLabel="Back to profile"
      title="Saved places"
    >
      <SavedPlacesEditor />
    </TabSubpage>
  );
}
