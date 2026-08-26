import { type ComponentType, type ReactNode } from "react";
import { redirect } from "next/navigation";
import {
  Inbox,
  LifeBuoy,
  Mail,
  ShieldCheck,
  Star,
  User,
  Wallet,
} from "lucide-react";

import { TabPage } from "@/components/limecab/limecab-shell";
import { PAYMENT_METHODS, RIDER, SAVED_PLACES } from "@/lib/limecab/mock";
import { auth } from "@/server/auth";

/**
 * The shortcut tiles below are presentation only: LimeCab has no wallet,
 * safety or inbox surface to send anyone to. They render as plain cards —
 * no link, no button, no hover — and say "Soon", because a tile that looks
 * tappable and isn't is a bug wearing a design.
 */
const SHORTCUTS = [
  { label: "Help", icon: LifeBuoy },
  { label: "Wallet", icon: Wallet },
  { label: "Safety", icon: ShieldCheck },
  { label: "Inbox", icon: Inbox },
] satisfies { label: string; icon: ComponentType<{ className?: string }> }[];

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const name = session.user.name ?? session.user.email ?? "Rider";
  const email = session.user.email;
  const profile = PAYMENT_METHODS[0];

  return (
    <TabPage title={name}>
      {/* The avatar rides with the chips: TabPage owns the heading, and a
          name long enough to wrap must not collide with a pulled-up circle. */}
      <div className="-mt-3 flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          <Chip icon={Star} label={RIDER.rating.toFixed(2)} />
          {email ? <Chip icon={Mail} label={email} /> : null}
        </div>
        <span
          aria-hidden="true"
          className="bg-accent text-accent-foreground flex size-14 shrink-0 items-center justify-center rounded-full text-[20px] font-semibold"
        >
          {name.charAt(0).toUpperCase()}
        </span>
      </div>

      {profile ? (
        <div className="bg-card ring-border mt-6 flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3 ring-1">
          <User
            className="text-muted-foreground size-5 shrink-0"
            strokeWidth={1.7}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium tracking-tight">
              {profile.label}
            </p>
            <p className="text-muted-foreground truncate text-sm tabular-nums">
              {profile.detail}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-3">
        {SHORTCUTS.map(({ label, icon: Icon }) => (
          <div
            key={label}
            className="bg-card ring-border flex h-[5.5rem] flex-col justify-between rounded-2xl p-4 ring-1"
          >
            <Icon
              className="text-muted-foreground size-6"
              strokeWidth={1.7}
              aria-hidden="true"
            />
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[15px] font-medium tracking-tight">
                {label}
              </span>
              <span className="text-muted-foreground text-xs">Soon</span>
            </div>
          </div>
        ))}
      </div>

      <ProfileSection title="Payment">
        {PAYMENT_METHODS.map((method) => (
          <Row key={method.id} label={method.label} value={method.detail} />
        ))}
      </ProfileSection>

      <ProfileSection title="Saved places">
        {SAVED_PLACES.filter((place) => place.source === "saved").map((place) => (
          <Row key={place.id} label={place.label} value={place.address} />
        ))}
      </ProfileSection>

      {/* Sign-out is a route handler, not a page: a real navigation. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/api/auth/signout"
        className="ring-border focus-visible:ring-ring active:bg-accent mt-7 flex min-h-14 items-center justify-center rounded-2xl text-[15px] font-medium tracking-tight ring-1 focus-visible:ring-2 focus-visible:outline-none"
      >
        Sign out
      </a>
    </TabPage>
  );
}

function Chip({
  icon: Icon,
  label,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
}) {
  return (
    <span className="bg-card ring-border flex max-w-full items-center gap-1.5 rounded-full ring-1 px-3 py-1.5 text-[13px] font-medium tracking-tight">
      <Icon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
      <span className="truncate tabular-nums">{label}</span>
    </span>
  );
}

function ProfileSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-7">
      <h2 className="text-[20px] font-semibold tracking-[-0.02em]">{title}</h2>
      <div className="divide-border bg-card ring-border mt-3 divide-y rounded-2xl ring-1">
        {children}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4">
      <span className="shrink-0 text-[15px] font-medium tracking-tight">
        {label}
      </span>
      <span className="text-muted-foreground min-w-0 flex-1 truncate text-right text-sm tabular-nums">
        {value}
      </span>
    </div>
  );
}
