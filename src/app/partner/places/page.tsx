import Link from "next/link";

/**
 * Places partner gateway — rooms, venues, and parking supply for Lime Spaces
 * and Lime Station. The desk lives at `/partner/places/app`.
 */
export default function PartnerPlacesPage() {
  return (
    <main className="bg-background text-foreground mx-auto flex min-h-dvh max-w-3xl flex-col px-5 pb-12 pt-[max(2rem,env(safe-area-inset-top))] md:px-8 md:pb-16">
      <Link
        href="/partner"
        className="text-muted-foreground text-[14px] font-medium underline-offset-2 hover:underline"
      >
        ← Partners
      </Link>

      <p className="text-lime font-heading mt-8 text-[13px] font-semibold tracking-[0.08em] uppercase">
        Places
      </p>
      <h1 className="font-heading mt-2 text-3xl font-semibold tracking-[-0.03em] md:text-4xl">
        List rooms & parking
      </h1>
      <p className="text-muted-foreground mt-3 max-w-xl text-[15px] leading-relaxed">
        List meeting rooms, venues, and parking for Lime Spaces & Station.
        Open the desk — map, opportunities, one Go live button, same posture
        as Drive.
      </p>

      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        <HubLink
          href="/partner/places/app"
          title="Open Places desk"
          body="You're offline until you go live. Your listings show on the map."
        />
        <HubLink
          href="/partner/places/app/listings/new?kind=room"
          title="Add a room or venue"
          body="Meeting room, event space, or overnight stay unit."
        />
        <HubLink
          href="/partner/places/app/listings/new?kind=parking"
          title="Add a parking lot"
          body="Garage, surface lot, or gated facility near where riders go."
        />
        <HubLink
          href="/signin"
          title="Sign in"
          body="Listings are tied to your partner account. Sign in to publish."
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
