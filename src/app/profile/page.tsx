import { StarIcon } from "@hugeicons/core-free-icons";
import { redirect } from "next/navigation";

import { TabPageFrame } from "@/components/limecab/limecab-shell";
import {
  ProfileHero,
  ProfileLinkRow,
  ProfileSection,
  SignOutLink,
} from "@/components/limecab/profile";
import { PAYMENT_METHODS, RIDER_PREFERENCES } from "@/lib/limecab/mock";
import { auth } from "@/server/auth";
import { api } from "@/trpc/server";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/signin?callbackUrl=/profile");

  const name = session.user.name ?? "Your account";
  const primaryPay = PAYMENT_METHODS[0];
  const [rider, places] = await Promise.all([api.rider.me(), api.places.list()]);
  // Their own slots, or nothing. An unset Home reads as unset.
  const saved = [places.home, places.work, ...places.custom].flatMap((place) =>
    place ? [place] : [],
  );
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
          { icon: StarIcon, label: "5.00", iconClassName: "text-lime" },
          { label: "LimeCab rider" },
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
          value={saved.map((place) => place.label).join(", ") || "Set Home"}
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

      <ProfileSection title="Partners">
        <ProfileLinkRow
          href="/partner"
          label="Partner with Lime"
          value="Fleets, freight, merchants"
        />
      </ProfileSection>

      <ProfileSection>
        <ProfileLinkRow href="/profile/help" label="Help" />
      </ProfileSection>

      <SignOutLink />
    </TabPageFrame>
  );
}
