import { StarIcon } from "@hugeicons/core-free-icons";
import { redirect } from "next/navigation";

import { TabPageFrame } from "@/components/limecab/limecab-shell";
import {
  ProfileHero,
  ProfileLinkRow,
  ProfileSection,
  SignOutLink,
} from "@/components/limecab/profile";
import {
  PAYMENT_METHODS,
  RIDER,
  RIDER_PREFERENCES,
  SAVED_PLACES,
} from "@/lib/limecab/mock";
import { auth } from "@/server/auth";
import { api } from "@/trpc/server";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/signin?callbackUrl=/profile");

  const name = session.user.name ?? RIDER.fullName;
  const saved = SAVED_PLACES.filter((place) => place.source === "saved");
  const primaryPay = PAYMENT_METHODS[0];
  const rider = await api.rider.me();
  const verification =
    rider.phoneVerifiedAt && rider.identityStatus === "verified"
      ? "Verified"
      : rider.identityStatus === "pending"
        ? rider.phoneVerifiedAt
          ? "ID in review"
          : "Phone still needed"
        : rider.phoneVerifiedAt
          ? "Add ID"
          : "Recommended";

  return (
    <TabPageFrame>
      <ProfileHero
        name={name}
        facts={[
          {
            icon: StarIcon,
            label: RIDER.rating.toFixed(2),
            iconClassName: "text-lime",
          },
          { label: RIDER.since },
        ]}
      />

      <ProfileSection title="Account">
        <ProfileLinkRow
          href="/profile/personal"
          label="Personal info"
          value={name}
        />
        <ProfileLinkRow
          href="/profile/verify"
          label="Verification"
          value={verification}
        />
        <ProfileLinkRow
          href="/profile/places"
          label="Saved places"
          value={saved.map((place) => place.label).join(", ")}
        />
        <ProfileLinkRow
          href="/profile/payment"
          label="Payment"
          value={primaryPay?.detail}
        />
      </ProfileSection>

      <ProfileSection title="Ride">
        <ProfileLinkRow
          href="/profile/preferences"
          label="Preferences"
          value={RIDER_PREFERENCES.defaultProductName}
        />
        <ProfileLinkRow
          href="/profile/safety"
          label="Safety & privacy"
          value="PIN on every ride"
        />
        <ProfileLinkRow
          href="/profile/notifications"
          label="Notifications"
          value="Trip updates on"
        />
      </ProfileSection>

      <ProfileSection>
        <ProfileLinkRow href="/profile/help" label="Help" />
      </ProfileSection>

      <SignOutLink />
    </TabPageFrame>
  );
}
