import { redirect } from "next/navigation";

import {
  ProfileNote,
  ProfileSection,
  ProfileValueRow,
  TabSubpage,
} from "@/components/limecab/profile";
import { PAYMENT_METHODS } from "@/lib/limecab/mock";
import { auth } from "@/server/auth";

export default async function PaymentPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  return (
    <TabSubpage backHref="/profile" backLabel="Back to profile" title="Payment">
      <ProfileSection>
        {PAYMENT_METHODS.map((method, index) => (
          <ProfileValueRow
            key={method.id}
            label={index === 0 ? `${method.label} · Default` : method.label}
            value={method.detail}
          />
        ))}
      </ProfileSection>
      <ProfileNote>
        The default method is charged when the ride ends. Adding a card
        isn&apos;t live in this build.
      </ProfileNote>
    </TabSubpage>
  );
}
