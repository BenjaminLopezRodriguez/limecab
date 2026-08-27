import { BackLink } from "@/components/limecab/profile";

export default function TripNotFound() {
  return (
    <div className="px-5 pb-[var(--nav-pill-clear,8rem)] md:mx-auto md:max-w-2xl md:px-6">
      <BackLink href="/activity" label="Back to activity" />
      <h1 className="font-heading mt-3 text-[34px] leading-none font-bold tracking-[-0.035em]">
        Trip not found
      </h1>
      <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
        That ride isn’t on this account.
      </p>
    </div>
  );
}
