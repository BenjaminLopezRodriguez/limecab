import { startOAuth } from "@/app/signin/actions";
import { PhoneSignIn } from "@/components/limecab/phone-signin";
import { providerMap } from "@/server/auth";

function signInErrorCopy(code?: string) {
  if (!code) return null;
  if (code === "OAuthAccountNotLinked") {
    return "This email already has an account. Sign in with the method you used first.";
  }
  if (code === "AccessDenied") return "Sign-in was cancelled.";
  if (code === "Configuration") return "Sign-in isn’t set up yet.";
  return "Sign-in didn’t finish. Try again.";
}

const COPY: Record<string, { label: string; className: string }> = {
  apple: {
    label: "Sign in with Apple",
    className:
      "bg-foreground text-background hover:bg-foreground/90 border-transparent",
  },
  google: {
    label: "Sign in with Google",
    className: "bg-card text-foreground ring-border hover:bg-muted ring-1",
  },
  discord: {
    label: "Sign in with Discord",
    className: "bg-card text-foreground ring-border hover:bg-muted ring-1",
  },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/";
  const error = signInErrorCopy(params.error);
  const buttons = [
    { id: "apple", name: "Apple" },
    { id: "google", name: "Google" },
    ...providerMap.filter((p) => p.id !== "apple" && p.id !== "google"),
  ];

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <p className="text-lime text-xs font-semibold tracking-[0.14em] uppercase">
        LimeCab
      </p>
      <h1 className="font-heading mt-3 text-[34px] leading-none font-bold tracking-[-0.035em]">
        Sign in
      </h1>
      <p className="text-muted-foreground mt-3 text-[15px] leading-relaxed">
        Book a ride with the same account on every device.
      </p>

      {error ? (
        <p role="alert" className="text-destructive mt-6 text-sm">
          {error}
        </p>
      ) : null}

      <PhoneSignIn callbackUrl={callbackUrl} />

      {buttons.length > 0 ? (
        <>
          <p className="text-muted-foreground mt-8 text-center text-xs font-semibold tracking-[0.14em] uppercase">
            or continue with
          </p>
          <ul className="mt-4 flex flex-col gap-3">
            {buttons.map((provider) => {
              const copy = COPY[provider.id] ?? {
                label: `Sign in with ${provider.name}`,
                className:
                  "bg-card text-foreground ring-border hover:bg-muted ring-1",
              };
              return (
                <li key={provider.id}>
                  <form action={startOAuth.bind(null, provider.id, callbackUrl)}>
                    <button
                      type="submit"
                      className={`focus-visible:ring-ring flex min-h-14 w-full items-center justify-center rounded-full text-[15px] font-semibold tracking-tight focus-visible:ring-2 focus-visible:outline-none ${copy.className}`}
                    >
                      {copy.label}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}
