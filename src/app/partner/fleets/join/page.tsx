import Link from "next/link";

import { JoinFleetForm } from "./join-form";

/**
 * Server shell only so the invite link can prefill the code without pulling
 * `useSearchParams` (and its Suspense boundary) into the client tree.
 */
export default async function PartnerFleetsJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  return (
    <main className="bg-background text-foreground mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-12 pt-[max(2rem,env(safe-area-inset-top))] md:px-8">
      <Link
        href="/partner/fleets"
        className="text-muted-foreground text-[14px] font-medium underline-offset-2 hover:underline"
      >
        ← Fleet hub
      </Link>

      <h1 className="font-heading mt-8 text-3xl font-semibold tracking-[-0.03em]">
        Join a fleet
      </h1>
      <p className="text-muted-foreground mt-3 text-[15px] leading-relaxed">
        Enter the code your fleet gave you. You&rsquo;ll see who you&rsquo;re
        joining and what the role can do before you accept.
      </p>

      <JoinFleetForm initialCode={code ?? ""} />
    </main>
  );
}
