import Link from "next/link";

/**
 * Fleet hub entry: operators manage drivers and vehicles; drivers join by
 * invite, which is what unlocks freight inside Drive.
 */
export default function PartnerFleetsPage() {
  return (
    <main className="bg-background text-foreground mx-auto flex min-h-dvh max-w-3xl flex-col px-5 pb-12 pt-[max(2rem,env(safe-area-inset-top))] md:px-8 md:pb-16">
      <Link
        href="/partner"
        className="text-muted-foreground text-[14px] font-medium underline-offset-2 hover:underline"
      >
        ← Partners
      </Link>

      <p className="text-lime font-heading mt-8 text-[13px] font-semibold tracking-[0.08em] uppercase">
        Fleets
      </p>
      <h1 className="font-heading mt-2 text-3xl font-semibold tracking-[-0.03em] md:text-4xl">
        Fleet hub
      </h1>
      <p className="text-muted-foreground mt-3 max-w-xl text-[15px] leading-relaxed">
        Operators invite drivers, keep vehicles ready, and open the freight
        board. Drivers accept an invite in Drive — same pattern as joining a
        fleet elsewhere.
      </p>

      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        <HubLink
          href="/driver"
          title="Open Drive"
          body="One road app. Assigned loads show up here after you join a fleet."
        />
        <HubLink
          href="/freight/carrier"
          title="Open carrier portal"
          body="Find loads, book, assign drivers, view earnings."
        />
        <HubLink
          href="/partner/fleets/invite"
          title="Invite to your fleet"
          body="Create a single-use code for a driver or dispatcher."
        />
        <HubLink
          href="/partner/fleets/join"
          title="Join a fleet"
          body="Enter an invite code. Accepting unlocks freight in Drive."
        />
      </ul>
    </main>
  );
}

function HubLink({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="bg-card ring-border hover:bg-accent/40 focus-visible:ring-ring block h-full rounded-3xl p-4 ring-1 transition-colors focus-visible:ring-2 focus-visible:outline-none sm:p-5"
      >
        <span className="font-heading block text-[17px] font-semibold tracking-[-0.02em]">
          {title}
        </span>
        <span className="text-muted-foreground mt-1 block text-[14px] leading-snug">
          {body}
        </span>
      </Link>
    </li>
  );
}
