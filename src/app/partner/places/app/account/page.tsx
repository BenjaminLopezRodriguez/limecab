import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DriverSubpage,
  ProfileHero,
  ProfileLinkRow,
  ProfileSection,
  SignOutLink,
} from "@/components/limecab/profile";
import { MOCK_PARTNER_LISTINGS } from "@/lib/partner/places-listings";
import { auth } from "@/server/auth";

export default async function PartnerPlacesAccountPage() {
  const session = await auth();
  const name = session?.user?.name ?? "Partner";
  const live = MOCK_PARTNER_LISTINGS.filter((row) => row.status === "live").length;

  return (
    <DriverSubpage
      backHref="/partner/places/app"
      backLabel="Back to desk"
      title="Your Places account"
    >
      <ProfileHero
        name={name}
        headingClassName="font-sans text-3xl font-semibold tracking-[-0.03em]"
        facts={[
          { label: `${live} live listings` },
          { label: `${MOCK_PARTNER_LISTINGS.length} total` },
        ]}
      />

      <ProfileSection tone="driver" title="Account">
        <ProfileLinkRow
          href="/signin"
          label="Sign in"
          value={session?.user?.email ?? "Guest preview"}
        />
        <ProfileLinkRow
          href="/partner/places/app/listings/new"
          label="Add a listing"
        />
      </ProfileSection>

      <ProfileSection tone="driver" title="On the desk">
        <ProfileLinkRow
          href="/partner/places/app/bookings"
          label="Bookings"
        />
        <ProfileLinkRow
          href="/partner/places/app/earnings"
          label="Earnings"
        />
      </ProfileSection>

      <ProfileSection tone="driver">
        <ProfileLinkRow href="/partner" label="All partner products" />
      </ProfileSection>

      {session ? (
        <SignOutLink />
      ) : (
        <Button
          size="lg"
          className="mt-8 h-16 w-full text-[17px]"
          render={<Link href="/signin" />}
        >
          Sign in to publish
        </Button>
      )}
    </DriverSubpage>
  );
}
