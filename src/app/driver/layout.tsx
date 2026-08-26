import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth } from "@/server/auth";

/**
 * Driver routes are their own app: a session gate and a bare header. The rider
 * tab bar is suppressed by the shell for this segment, so nothing here fights it.
 */
export default async function DriverLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  return (
    <div className="mx-auto max-w-md px-5 pb-10 text-[16px]">
      <header className="bg-background sticky top-0 z-10 flex h-16 items-center justify-between">
        <Link
          href="/driver"
          className="focus-visible:ring-ring rounded-lg text-[21px] font-semibold tracking-[-0.03em] focus-visible:ring-2 focus-visible:outline-none"
        >
          LimeCab <span className="text-lime">Driver</span>
        </Link>
      </header>
      {children}
    </div>
  );
}
